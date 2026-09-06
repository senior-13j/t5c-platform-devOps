import Logger from "../../utils/Logger";
import { Vector3 } from "../../../shared/Libs/yuka-min";
import { EntityState, PlayerInputs } from "../../../shared/types";
import { BrainSchema, LootSchema, PlayerSchema } from "../schema";
import { getSingleTargetAbilityRange } from "../gameplayRules";
import { isMovementDisplacementAllowed, normalizeMovementInput } from "../GameplayMessageGuard";

export class moveCTRL {
    private _owner: PlayerSchema;

    private currentRegion;
    private movementMode: "manual" | "path" | null = null;
    private movementStepConsumed = false;

    constructor(owner) {
        this._owner = owner;
    }

    public update() {
        try {
            // if player has a target
            if (this._owner.hasTarget()) {
                const activeTarget = this._owner.AI_TARGET;
                const registeredTarget = activeTarget?.sessionId
                    ? this._owner._state?.entities?.get(activeTarget.sessionId)
                    : null;
                const isLootTarget = activeTarget instanceof LootSchema;
                const isCombatTarget =
                    Boolean(this._owner.AI_ABILITY) &&
                    (activeTarget instanceof BrainSchema || activeTarget instanceof PlayerSchema);
                if (registeredTarget !== activeTarget || (!isLootTarget && !isCombatTarget)) {
                    this.cancelAutomatedMovement();
                    return;
                }

                // monitor player's target position
                this._owner.monitorTarget();

                // find the path to target position
                if (this._owner.AI_TARGET_WAYPOINTS.length < 1) {
                    if (!this.setTargetDestination(this._owner.AI_TARGET_POSITION)) {
                        this.cancelAutomatedMovement();
                        return;
                    }
                }

                // check distance to target
                let distance = this._owner.AI_TARGET_DISTANCE;
                let target = this._owner.AI_TARGET;
                let ability = this._owner.AI_ABILITY;

                // do pickup item if close enough
                if (distance < 1 && target instanceof LootSchema) {
                    this._owner.pickupItem(target);
                    // One click produces one pickup attempt. A full inventory
                    // or otherwise rejected transfer must not rebuild a path
                    // and retry every simulation tick until the loot expires.
                    this.cancelAutomatedMovement();
                }

                // do auto attack
                if (this._owner.AI_ABILITY && (target instanceof BrainSchema || target instanceof PlayerSchema)) {
                    if (distance <= getSingleTargetAbilityRange(ability)) {
                        // Revalidate resources/cooldown after the potentially long
                        // path to the target, then cast with the original hotbar digit.
                        const castSucceeded = this._owner.abilitiesCTRL.castIfAllowed(
                            this._owner,
                            target,
                            ability,
                            ability.digit ?? 1
                        );

                        if (castSucceeded) {
                            this._owner.AI_TARGET_FOUND = true;
                        }

                        // Abilities are one-shot. Keeping a target without an
                        // ability would rebuild the same path every server tick.
                        this.cancelAutomatedMovement();
                    }
                }

                // if already found and target escapes
                if (distance > 2.5 && this._owner.AI_TARGET_FOUND) {
                    //this._owner.abilitiesCTRL.cancelAutoAttack(this._owner);
                    this.cancelAutomatedMovement();
                }
            }

            // A manual message and an automated path are allowed to consume at
            // most one horizontal movement step between simulation updates.
            if (
                !this.movementStepConsumed &&
                this._owner.AI_TARGET_WAYPOINTS &&
                this._owner.AI_TARGET_WAYPOINTS.length > 0
            ) {
                this.movementMode = "path";
                this.movementStepConsumed = this.moveTowards();
            }
        } finally {
            this.movementStepConsumed = false;
            if (this.movementMode === "manual") {
                this.movementMode = null;
            }
        }
    }

    cancelTargetDestination() {
        this._owner.AI_TARGET_WAYPOINTS = [];
        this._owner.AI_TARGET_DISTANCE = 0;
        this._owner.AI_TARGET_POSITION = null;
        this._owner.AI_ABILITY = null;
        this.movementMode = null;
    }

    cancelAutomatedMovement() {
        this._owner.AI_TARGET = null;
        this._owner.AI_TARGET_FOUND = false;
        this.cancelTargetDestination();
    }

    setClickToMoveDestination(targetPos: Vector3): boolean {
        this.cancelAutomatedMovement();
        return this.setTargetDestination(targetPos);
    }

    setTargetDestination(targetPos: Vector3): boolean {
        if (!targetPos || !this._owner?._navMesh) {
            return false;
        }
        const foundPath: any = this._owner._navMesh.checkPath(this._owner.getPosition(), targetPos);
        if (foundPath) {
            const waypoints = this._owner._navMesh.findPath(this._owner.getPosition(), targetPos);
            if (Array.isArray(waypoints)) {
                this._owner.AI_TARGET_WAYPOINTS = waypoints;
                this._owner.AI_TARGET_WAYPOINTS.push(targetPos);
                this.movementMode = "path";
                return true;
            }
        }
        return false;
    }

    moveTowards(type: string = "seek"): boolean {
        // move entity
        if (this._owner.AI_TARGET_WAYPOINTS.length > 0) {
            let currentPos = this._owner.getPosition();

            // get next waypoint
            let destinationOnPath = this._owner.AI_TARGET_WAYPOINTS[0];

            // calculate next position towards destination
            let updatedPos = this.moveTo(currentPos, destinationOnPath, this._owner.speed);
            this.setPosition(updatedPos);

            // calculate rotation
            this._owner.rot = this.calculateRotation(currentPos, updatedPos);

            // check if arrived at waypoint
            if (destinationOnPath.distanceTo(updatedPos) < 1) {
                this._owner.AI_TARGET_WAYPOINTS.shift();
            }
            return Math.hypot(updatedPos.x - currentPos.x, updatedPos.z - currentPos.z) > 1e-6;
        } else {
            console.error("moveTowards failed");
            // something is wrong, let's look for a new destination
            //this.resetDestination();
        }
        return false;
    }

    /**
     * Calculate rotation based on moving from v1 to v2
     * @param {Vector3} v1
     * @param {Vector3} v2
     * @returns rotation in radians
     */
    calculateRotation(v1: Vector3, v2: Vector3): number {
        return Math.atan2(v1.x - v2.x, v1.z - v2.z);
    }

    setPosition(updatedPos: Vector3): void {
        this._owner.x = updatedPos.x;
        this._owner.y = updatedPos.y;
        this._owner.z = updatedPos.z;
    }

    /**
     * Calculate next forward position on the navmesh based on playerInput forces
     * @param {PlayerInputs} playerInput
     * @returns
     */
    processPlayerInput(playerInput: PlayerInputs) {
        if (this._owner.blocked || this._owner.isDead) {
            //this._owner.state = EntityState.IDLE;
            Logger.warning("Player " + this._owner.name + " is blocked, no movement will be processed");
            return false;
        }

        // cancel any auto attack
        //this._owner.abilitiesCTRL.cancelAutoAttack(this._owner);
        const normalizedInput = normalizeMovementInput(playerInput, this._owner.sequence);
        if (!normalizedInput) {
            return false;
        }
        const horizontal = normalizedInput.h;
        const vertical = normalizedInput.v;
        const speed = Number(this._owner.speed);
        if (!Number.isFinite(speed) || speed <= 0) {
            return false;
        }

        // A valid manual input explicitly takes control away from click-to-move,
        // pickup and combat pursuit. Do not let both modes move in one tick.
        this.cancelAutomatedMovement();
        this.movementMode = "manual";
        if (this.movementStepConsumed) {
            return false;
        }

        // save current position
        let oldX = this._owner.x;
        let oldY = this._owner.y;
        let oldZ = this._owner.z;
        let oldRot = this._owner.rot;

        // calculate new position
        let newX = this._owner.x - horizontal * speed;
        let newY = oldY;
        let newZ = this._owner.z - vertical * speed;
        let newRot = Math.atan2(horizontal, vertical);

        // check if destination is in navmesh
        let sourcePos = new Vector3(oldX, oldY, oldZ); // new pos
        let destinationPos = new Vector3(newX, newY, newZ); // new pos

        // get clamped position
        let clampedPosition = this._owner._navMesh.clampMovementV2(sourcePos, destinationPos) as Vector3;
        const requestedDistance = speed * Math.hypot(horizontal, vertical);
        if (!clampedPosition || !isMovementDisplacementAllowed(sourcePos, clampedPosition, requestedDistance + 0.01)) {
            return false;
        }

        // collision detected, return player old position
        this._owner.x = clampedPosition.x;
        this._owner.y = clampedPosition.y;
        this._owner.z = clampedPosition.z;
        this._owner.rot = newRot;
        this._owner.sequence = normalizedInput.seq;
        this.movementStepConsumed = true;

        //
        let nextRegion = this._owner._navMesh.getRegionForPoint(clampedPosition, 0.5);
        if (nextRegion && nextRegion.plane) {
            const distance = nextRegion.plane.distanceToPoint(clampedPosition);
            newY -= distance; // smooth transition
        }
        return true;
    }

    /**
     * Move entity toward a Vector3 position
     * @param {Vector3} source
     * @param {Vector3} destination
     * @param {number} speed movement speed
     * @returns {Vector3} new position
     */
    moveTo(source: Vector3, destination: Vector3, speed: number): Vector3 {
        let newPos = new Vector3(source.x, source.y, source.z);
        const deltaX = destination?.x - source?.x;
        const deltaZ = destination?.z - source?.z;
        const horizontalDistance = Math.hypot(deltaX, deltaZ);
        if (
            ![source?.x, source?.y, source?.z, destination?.x, destination?.y, destination?.z, speed, horizontalDistance].every(
                Number.isFinite
            ) ||
            speed <= 0
        ) {
            return newPos;
        }

        if (horizontalDistance > 0) {
            const step = Math.min(speed, horizontalDistance);
            newPos.x += (deltaX / horizontalDistance) * step;
            newPos.z += (deltaZ / horizontalDistance) * step;
        }

        // adjust height of the entity according to the ground
        // todo: improve performance here
        // adjust y position of the player according to the navmesh
        let currentRegion = this._owner._navMesh.getRegionForPoint(newPos, 0.5);
        if (currentRegion && currentRegion.plane) {
            const distance = currentRegion.plane.distanceToPoint(newPos);
            newPos.y -= distance; // smooth transition*/
        }

        return newPos;
    }
}
