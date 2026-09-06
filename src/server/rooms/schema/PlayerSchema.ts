import { Schema, MapSchema, type, view } from "@colyseus/schema";
import { abilitiesCTRL } from "../controllers/abilityCTRL";
import { animationCTRL } from "../controllers/animationCTRL";
import { moveCTRL } from "../controllers/moveCTRL";
import { dynamicCTRL } from "../controllers/dynamicCTRL";
import { statsCTRL } from "../controllers/statsCTRL";
import { NavMesh, Vector3 } from "../../../shared/Libs/yuka-min";
import { InventorySchema, EquipmentSchema, AbilitySchema, LootSchema, BrainSchema, QuestSchema, HotbarSchema } from "../schema";
import { GameRoomState } from "../state/GameRoomState";
import { Entity } from "../schema/Entity";
import { EntityState, ItemClass, CalculationTypes } from "../../../shared/types";
import { nanoid } from "nanoid";
import {
    MAX_INVENTORY_QUANTITY,
    MAX_TRADE_QUANTITY,
    STARTER_ABILITY_KEYS,
    calculateDroppedQuantity,
    calculateIncreasedBalance,
    calculatePurchaseCost,
    calculateRemainingQuantity,
    canClaimWorldEntity,
    clampHealth,
    getLocationSpawnPoint,
    isEquippedItemRequestValid,
    isConsumableCooldownReady,
    isItemQuantityCompatibleWithStacking,
    isVendorWithinRange,
    meetsItemRequirements,
    parsePositiveQuantity,
} from "../gameplayRules";

export class PlayerData extends Schema {
    @type({ map: InventorySchema }) inventory = new MapSchema<InventorySchema>();
    @type({ map: AbilitySchema }) abilities = new MapSchema<AbilitySchema>();
    @type({ map: QuestSchema }) quests = new MapSchema<QuestSchema>();
    @type({ map: HotbarSchema }) hotbar = new MapSchema<HotbarSchema>();
    @type("uint32") public gold: number = 0;
    @type("uint8") public strength: number = 0;
    @type("uint8") public endurance: number = 0;
    @type("uint8") public agility: number = 0;
    @type("uint8") public intelligence: number = 0;
    @type("uint8") public wisdom: number = 0;
    @type("uint32") public experience: number = 0;
    @type("uint32") public points: number = 5;
    @type("uint32") public ac: number = 0;
}

export class PlayerSchema extends Entity {
    /////////////////////////////////////////////////////////////
    // the below will be synced to all the players
    @type("number") public x: number = 0;
    @type("number") public y: number = 0;
    @type("number") public z: number = 0;
    @type("number") public rot: number = 0;

    @type("int16") public health: number = 0;
    @type("int16") public maxHealth: number = 0;
    @type("int16") public mana: number = 0;
    @type("int16") public maxMana: number = 0;
    @type("uint8") public level: number = 0;

    @type("string") public name: string = "";
    @type("string") public type: string = "player";
    @type("string") public race: string = "male_knight";
    @type("string") public head: string = "Head_Base";
    @type("int8") public material: number = 0;

    @type("string") public location: string = "";
    @type("number") public sequence: number = 0; // latest input sequence
    @type("boolean") public blocked: boolean = false; // if true, used to block player and to prevent movement
    @type("int8") public anim_state: EntityState = EntityState.IDLE;

    @type({ map: EquipmentSchema }) equipment = new MapSchema<EquipmentSchema>();

    ////////////////////////////////////////////////////////////////////////////
    // the below data only need to synchronized to the player it belongs too
    // player data
    @view()
    @type(PlayerData)
    player_data: PlayerData = new PlayerData();

    /////////////////////////////////////////////////////////////
    // does not need to be synced
    public id: number = 0;
    public manaRegen: number = 0;
    public healthRegen: number = 0;
    public speed: number = 0;
    public experienceGain: number = 0;
    public gracePeriod: boolean = true;
    public attackTimer;
    public isMoving: boolean = false;
    public isDead: boolean = false;
    public isTeleporting: boolean = false;
    public isInteracting;
    public interactingStep: number = 0;
    public interactingTarget: BrainSchema;

    // controllers
    public _navMesh: NavMesh;
    public _state: GameRoomState;
    public client;
    public abilitiesCTRL: abilitiesCTRL;
    public moveCTRL: moveCTRL;
    public animationCTRL: animationCTRL;
    public dynamicCTRL: dynamicCTRL;
    public statsCTRL: statsCTRL;

    // TIMER
    public spawnTimer: number = 0;
    public regenTimer: number = 5000;
    public regenTimerElapsed: number = 0;

    ////////////////////////////
    public AI_TARGET = null; // AI_TARGET will always represent an entity
    public AI_TARGET_POSITION = null;
    public AI_TARGET_DISTANCE = null;
    public AI_TARGET_WAYPOINTS = [];
    public AI_ABILITY = null;
    public AI_TARGET_FOUND = false;
    public AI_TARGET_ATTACK_SPOTS;

    // inventory
    public INVENTORY_LENGTH = 25;
    private itemCooldownUntil = new Map<string, number>();

    constructor(state: GameRoomState, data) {
        super();
        //
        this._navMesh = state.navMesh;
        this._state = state;
        this.client = this.getClient();
        this.isTeleporting = false;

        // add default race data
        Object.assign(this, this._state.gameData.get("race", data.race));

        // add spawn data
        Object.assign(this, data);

        // add default player data (from DB)
        Object.entries(data.initial_player_data).forEach(([k, v]) => {
            this.player_data[k] = v;
        });

        // initalize stats
        this.statsCTRL = new statsCTRL(this);

        // add abilities
        data.initial_abilities.forEach((element) => {
            const key = typeof element?.key === "string" ? element.key : "";
            if (key && this._state.gameData.get("ability", key)) {
                this.player_data.abilities.set(key, new AbilitySchema({ key }));
            }
        });

        // Older Arkadii Quest characters were created with starter skills on
        // their hotbar but only two rows in character_abilities. Reconcile that
        // historical loadout once on load so the server can enforce ownership
        // without breaking existing characters.
        STARTER_ABILITY_KEYS.forEach((key) => {
            if (!this.player_data.abilities.has(key) && this._state.gameData.get("ability", key)) {
                this.player_data.abilities.set(key, new AbilitySchema({ key }));
            }
        });

        // add equipment
        data.initial_equipment.forEach((element) => {
            this.equipment.set(element.key, new EquipmentSchema(element, this));
        });

        // add quests
        data.initial_quests.forEach((element) => {
            this.player_data.quests.set(element.key, new QuestSchema(element));
        });

        // add hotbar
        data.initial_hotbar.forEach((element) => {
            const digit = Number(element?.digit);
            const entryType = element?.type;
            const key = typeof element?.key === "string" ? element.key : "";
            const isKnownAbility = entryType === "ability" && this.player_data.abilities.has(key);
            const isKnownItem = entryType === "item" && Boolean(this._state.gameData.get("item", key));
            if (
                Number.isSafeInteger(digit) &&
                digit >= 1 &&
                digit <= this._state.config.PLAYER_HOTBAR_SIZE &&
                key &&
                (isKnownAbility || isKnownItem)
            ) {
                this.player_data.hotbar.set(String(digit), new HotbarSchema({ digit, type: entryType, key }));
            }
        });

        // add inventory items
        let i = 0;
        data.initial_inventory.forEach((element) => {
            element.i = "" + i;
            this.player_data.inventory.set("" + i, new InventorySchema(element));
            i++;
        });

        // set controllers
        this.abilitiesCTRL = new abilitiesCTRL(this);
        this.moveCTRL = new moveCTRL(this);
        this.animationCTRL = new animationCTRL(this);
        this.dynamicCTRL = new dynamicCTRL(this);

        //
        this.start();
    }

    // on player state initialized
    start() {
        // add a 5 second grace period where the player can not be targeted by the ennemies
        setTimeout(() => {
            this.gracePeriod = false;
        }, this._state.config.PLAYER_GRACE_PERIOD);
    }

    // runs on every server iteration
    update() {
        // always check if player is dead ??
        if (this.isEntityDead() && !this.isDead) {
            //this.setAsDead();
        }

        // if not dead
        if (this.isDead === true) {
            // if player is dead make sure player animation is EntityState.DEAD
            if (this.anim_state !== EntityState.DEAD) {
                this.anim_state = EntityState.DEAD;
            }
            return false;
        }

        // regen timer 5seconds
        this.regenTimerElapsed += this._state.config.updateRate;
        if (this.regenTimerElapsed >= this.regenTimer) {
            // continuously gain mana
            if (this.mana < this.maxMana) {
                this.mana = clampHealth(this.mana + this.manaRegen, this.maxMana);
            }
            // continuously gain health
            if (this.health < this.maxHealth) {
                this.health = clampHealth(this.health + this.healthRegen, this.maxHealth);
            }
            this.regenTimerElapsed = 0;
        }

        // update dynamic stuuf
        this.dynamicCTRL.update();

        // move player
        this.moveCTRL.update();
    }

    public getClient() {
        return this._state._gameroom.clients.getById(this.sessionId);
    }

    /**
     * Calculate rotation based on moving from v1 to v2
     * @param {Vector3} v1
     * @param {Vector3} v2
     * @returns rotation in radians
     */
    rotateTowards(v1: Vector3, v2: Vector3): number {
        return Math.atan2(v1.x - v2.x, v1.z - v2.z);
    }

    //////////////////////////////////////////////
    /////////////// HOTBAR ///////////////////////
    //////////////////////////////////////////////

    findNextAvailableHotbarSlot(): number | boolean {
        if (this.player_data.hotbar.size > 0) {
            for (let i = 1; i <= this._state.config.PLAYER_HOTBAR_SIZE; i++) {
                if (!this.player_data.hotbar.get("" + i)) {
                    return i;
                }
            }
            return false;
        }
        return 1;
    }

    //////////////////////////////////////////////
    /////////////// INVENTORY ////////////////////
    //////////////////////////////////////////////

    getInventoryItem(value, key = "index"): InventorySchema {
        let found;
        this.player_data.inventory.forEach((el, k) => {
            if (key === "index" && k === value) {
                found = el;
            } else if (key === "key" && el.key === value) {
                found = el;
            }
        });
        return found;
    }

    getInventoryItemByIndex(value): InventorySchema {
        return this.player_data.inventory.get("" + value);
    }

    findNextAvailableInventorySlot(): string | boolean {
        if (this.player_data.inventory.size > 0) {
            for (let i = 0; i < this._state.config.PLAYER_INVENTORY_SPACE; i++) {
                if (!this.player_data.inventory.get("" + i)) {
                    return "" + i;
                }
            }
            return false;
        }
        return "" + 0;
    }

    isEquipementSlotAvailable(slot) {
        let available = true;
        this.equipment.forEach((item) => {
            if (item.slot === slot) {
                available = false;
            }
        });
        return available;
    }

    reduceItemQuantity(inventoryItem, amount = 1) {
        const remainingQuantity = calculateRemainingQuantity(inventoryItem?.qty, amount);
        if (remainingQuantity === null) {
            return false;
        }

        if (remainingQuantity === 0) {
            this.player_data.inventory.delete("" + inventoryItem.i);
        } else {
            inventoryItem.qty = remainingQuantity;
        }
        return true;
    }

    increaseItemQuantity(inventoryItem, amount = 1) {
        const quantityToAdd = parsePositiveQuantity(amount);
        const currentQuantity = parsePositiveQuantity(inventoryItem?.qty);
        if (quantityToAdd === null || currentQuantity === null || currentQuantity + quantityToAdd > MAX_INVENTORY_QUANTITY) {
            return false;
        }
        inventoryItem.qty = currentQuantity + quantityToAdd;
        return true;
    }

    dropItem(inventoryItem, dropAll = false) {
        const droppedQuantity = calculateDroppedQuantity(inventoryItem?.qty, dropAll === true);
        if (droppedQuantity === null) {
            return false;
        }
        let data = {
            key: inventoryItem.key,
            sessionId: nanoid(10),
            x: this.x,
            y: this.y,
            z: this.z,
            qty: droppedQuantity,
        };
        let entity = new LootSchema(this._state, data);
        if (!this._state.addGroundLoot(entity)) {
            return false;
        }

        if (dropAll) {
            this.player_data.inventory.delete("" + inventoryItem.i);
        } else if (!this.reduceItemQuantity(inventoryItem, 1)) {
            this._state.deleteEntity(entity.sessionId);
            return false;
        }

        return true;
    }

    buyItem(item, qty) {
        const quantity = parsePositiveQuantity(qty, MAX_TRADE_QUANTITY);
        const totalPrice = calculatePurchaseCost(item?.value, qty, this.player_data.gold);
        if (
            quantity === null ||
            totalPrice === null ||
            !item?.key ||
            !isItemQuantityCompatibleWithStacking(item.stackable, quantity) ||
            !this.isNearVendor(item.key)
        ) {
            return false;
        }

        let loot = new LootSchema(this._state, {
            key: item.key,
            qty: quantity,
        });
        if (!this.pickupItem(loot)) {
            return false;
        }

        this.player_data.gold -= totalPrice;
        return true;
    }

    sellItem(inventoryItem) {
        const unitPrice = Number(inventoryItem?.value);
        const updatedBalance = calculateIncreasedBalance(this.player_data.gold, unitPrice);
        if (
            parsePositiveQuantity(inventoryItem?.qty) === null ||
            inventoryItem?.sellable !== true ||
            !Number.isSafeInteger(unitPrice) ||
            unitPrice < 0 ||
            updatedBalance === null ||
            !this.isNearVendor()
        ) {
            return false;
        }

        // reduce inventory qty
        if (!this.reduceItemQuantity(inventoryItem, 1)) {
            return false;
        }

        // add gold to player
        this.player_data.gold = updatedBalance;

        return true;
    }

    pickupItem(loot: LootSchema) {
        // play animation // disabled
        //this.animationCTRL.playAnim(this, EntityState.PICKUP, () => {});

        const registeredEntity =
            typeof loot?.sessionId === "string" && loot.sessionId.length > 0
                ? this._state.entities.get(loot.sessionId)
                : undefined;
        if (!canClaimWorldEntity(loot?.sessionId, registeredEntity, loot)) {
            return false;
        }

        const quantity = parsePositiveQuantity(loot?.qty);
        let item = loot?.key ? this._state.gameData.get("item", loot.key) : null;
        if (quantity === null || !item || !isItemQuantityCompatibleWithStacking(item.stackable, quantity)) {
            return false;
        }

        // is item already inventory
        let inventoryItem = this.getInventoryItem(loot.key, "key");

        // is item stackable
        if (item.stackable && inventoryItem) {
            // increnent quantity
            if (!this.increaseItemQuantity(inventoryItem, quantity)) {
                return false;
            }
        } else {
            const availableSlot = this.findNextAvailableInventorySlot();
            if (availableSlot === false) {
                return false;
            }

            let data = {
                key: loot.key,
                qty: quantity,
                i: "" + availableSlot,
            };
            // add inventory item
            this.player_data.inventory.set("" + data.i, new InventorySchema(data));
        }

        // delete loot
        if (this._state.entities.get(loot.sessionId) === loot) {
            this._state.deleteEntity(loot.sessionId);
            this._state.removeTarget(loot.sessionId);
        }

        // stop chasing target
        this.AI_TARGET = null;
        return true;
    }

    private isNearVendor(itemKey?: string): boolean {
        const spawns = this._state?.roomDetails?.dynamic?.spawns ?? [];
        return isVendorWithinRange(this.getPosition(), spawns, itemKey);
    }

    consumeItem(item, now: number = Date.now()) {
        const key = typeof item?.key === "string" ? item.key : "";
        const definition = key ? this._state.gameData.get("item", key) : null;
        const ownedItem = item?.i !== undefined ? this.getInventoryItemByIndex(item.i) : null;
        const cooldown = Number(definition?.cooldown ?? 0);
        if (
            !key ||
            ownedItem !== item ||
            definition?.class !== ItemClass.CONSUMABLE ||
            !Number.isFinite(cooldown) ||
            cooldown < 0 ||
            !isConsumableCooldownReady(this.itemCooldownUntil.get(key), now) ||
            parsePositiveQuantity(item.qty) === null
        ) {
            return false;
        }

        const modifiers = definition.statModifiers;
        if (!modifiers || typeof modifiers !== "object") {
            return false;
        }

        const nextStats = new Map<string, number>();
        for (const [stat, effects] of Object.entries(modifiers)) {
            if ((stat !== "health" && stat !== "mana") || !Array.isArray(effects)) {
                return false;
            }
            let value = Number(nextStats.get(stat) ?? this[stat]);
            if (!Number.isFinite(value)) {
                return false;
            }
            for (const modifier of effects as any[]) {
                const amount = Number(modifier?.value);
                if (!Number.isFinite(amount) || amount < 0) {
                    return false;
                }
                if (modifier.type === CalculationTypes.ADD) {
                    value += amount;
                } else if (modifier.type === CalculationTypes.REMOVE) {
                    value -= amount;
                } else {
                    return false;
                }
            }
            nextStats.set(stat, value);
        }

        // Consume first; effects and cooldown are committed only when the
        // authoritative inventory decrement succeeds.
        if (!this.reduceItemQuantity(item, 1)) {
            return false;
        }
        this.itemCooldownUntil.set(key, now + cooldown);
        nextStats.forEach((value, stat) => {
            this[stat] = value;
        });
        this.normalizeStats();
        return true;
    }

    equipItem(item) {
        const key = typeof item?.key === "string" ? item.key : "";
        const definition = key ? this._state.gameData.get("item", key) : null;
        if (definition?.class !== ItemClass.ARMOR && definition?.class !== ItemClass.WEAPON) {
            return false;
        }

        // make sure item is equipable
        if (!definition.equippable) {
            return false;
        }

        let slot = definition.equippable.slot;

        // if can equip
        if (this.canEquip(item, slot, definition)) {
            // remove from inventory
            if (!this.reduceItemQuantity(item, 1)) {
                return false;
            }

            // equip
            this.equipment.set(key, new EquipmentSchema({ key: key, slot: slot }, this));
            return true;
        }
        return false;
    }

    unequipItem(key, slot?) {
        const equippedItem = typeof key === "string" ? this.equipment.get(key) : null;
        const item = typeof key === "string" ? this._state.gameData.get("item", key) : null;
        if (!isEquippedItemRequestValid(key, slot, equippedItem, item)) {
            return false;
        }

        // Add the item first so an unexpected inventory failure cannot destroy
        // the player's equipment.
        const addedToInventory = this.pickupItem(
            new LootSchema(this._state, {
                key: key,
                qty: 1,
            })
        );
        if (!addedToInventory) {
            return false;
        }

        this.equipment.delete(key);
        this.statsCTRL.unequipItem(item);
        return true;
    }

    canEquip(item, slot, definition = item) {
        return (
            item &&
            this.getInventoryItemByIndex(item.i) === item &&
            parsePositiveQuantity(item.qty) !== null &&
            definition?.equippable?.slot === slot &&
            meetsItemRequirements(definition, this) &&
            this.isEquipementSlotAvailable(slot) === true
        );
    }

    ///////////////////////////////////////////////
    ///////////////////////////////////////////////
    ///////////////////////////////////////////////

    setAsDead() {
        this.AI_TARGET = null;
        this.AI_ABILITY = null;
        this.isDead = true;
        this.health = 0;
        this.blocked = true;
        this.anim_state = EntityState.DEAD;
        console.log("setAsDead", "SET AS DEAD", this.sessionId);
    }

    resetPosition() {
        const spawnPoint = getLocationSpawnPoint(this._state?.roomDetails);
        if (!spawnPoint || this.isDead) {
            return false;
        }

        this.x = spawnPoint.x;
        this.y = spawnPoint.y;
        this.z = spawnPoint.z;
        this.rot = spawnPoint.rot;
        this.location = this._state.roomDetails.key ?? this.location;
        this.AI_TARGET = null;
        this.AI_TARGET_POSITION = null;
        this.AI_TARGET_WAYPOINTS = [];
        this.AI_ABILITY = null;
        this.blocked = false;
        this.anim_state = EntityState.IDLE;
        return true;
    }

    ressurect() {
        this.isDead = false;
        this.health = clampHealth(this.maxHealth, this.maxHealth);
        this.mana = this.maxMana;
        this.blocked = false;
        this.gracePeriod = true;
        this.anim_state = EntityState.IDLE;
        setTimeout(() => {
            this.gracePeriod = false;
        }, this._state.config.PLAYER_GRACE_PERIOD);
    }

    /**
     * is entity dead (isDead is there to prevent setting a player as dead multiple time)
     * @returns true if health smaller than 0 and not already set as dead.
     */
    isEntityDead() {
        return this.health <= 0;
    }

    // make sure no value are out of range
    normalizeStats() {
        this.health = clampHealth(this.health, this.maxHealth);

        // mana
        if (this.mana > this.maxMana) {
            this.mana = this.maxMana;
        }
        if (this.mana < 0) {
            this.mana = 0;
        }
    }

    getPosition() {
        return new Vector3(this.x, this.y, this.z);
    }

    hasTarget() {
        return this.AI_TARGET ?? false;
    }

    setTarget(target) {
        this.AI_TARGET = target;
    }

    monitorTarget() {
        if (this.AI_TARGET !== null && this.AI_TARGET !== undefined) {
            let targetPos = this.AI_TARGET.getPosition();
            let entityPos = this.getPosition();
            let distanceBetween = entityPos.distanceTo(targetPos);
            this.AI_TARGET_POSITION = targetPos;
            this.AI_TARGET_DISTANCE = distanceBetween;
        }
    }
}
