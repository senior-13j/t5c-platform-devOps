import { expect, Page, test } from "@playwright/test";

type Box = { x: number; y: number; width: number; height: number };

function monitorRuntimeErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
    page.on("console", (message) => {
        if (message.type() === "error") {
            errors.push(`console: ${message.text()}`);
        }
    });
    page.on("requestfailed", (request) => {
        errors.push(`request: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
    });
    return errors;
}

async function playerPosition(page: Page): Promise<number[]> {
    return page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._currentPlayer.getPosition().asArray());
}

async function guiControlBox(page: Page, control: "hotbar" | "character-menu" | "character-panel" | "panel-close"): Promise<Box> {
    return page.evaluate((controlName) => {
        const ui = (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui;
        const texture = ui.MAIN_ADT;
        const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
        const canvasBox = canvas.getBoundingClientRect();
        const textureSize = texture.getSize();
        const scaleX = canvasBox.width / textureSize.width;
        const scaleY = canvasBox.height / textureSize.height;
        const target =
            controlName === "hotbar"
                ? texture.getControlByName("ability_1")
                : controlName === "character-menu"
                  ? ui._MainMenu._menuButtons[3]
                  : controlName === "character-panel"
                    ? ui.panelCharacter._panel
                    : ui.panelCharacter._panelClose;
        const measure = target._currentMeasure;
        return {
            x: canvasBox.left + measure.left * scaleX,
            y: canvasBox.top + measure.top * scaleY,
            width: measure.width * scaleX,
            height: measure.height * scaleY,
        };
    }, control);
}

function center(box: Box): { x: number; y: number } {
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function overlapArea(first: Box, second: Box): number {
    const width = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));
    const height = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
    return width * height;
}

test("keyboard controls and automatic camera drive the English game", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium");
    const runtimeErrors = monitorRuntimeErrors(page);

    await page.goto("/");
    await expect(page.locator("#entrySetupOverlay")).toHaveAttribute("role", "dialog");
    await expect(page.locator("#entrySetupOverlay")).toHaveAttribute("aria-modal", "true");
    await expect(page.locator("#entrySetupForm fieldset")).toHaveCount(2);
    await page.locator('input[name="locale"][value="en"]').check();
    await page.locator('input[name="controlMode"][value="keyboard"]').check();
    await page.locator("#entrySetupForm button[type=submit]").click();
    await expect
        .poll(() => page.evaluate(() => [localStorage.getItem("arkadii_quest_locale"), localStorage.getItem("arkadii_quest_control_mode")]))
        .toEqual(["en", "keyboard"]);
    await page.waitForFunction(() => (window as any).__ARKADII_QUEST_APP__?.game?.gamescene?.playerIsSpawned === true, null, {
        timeout: 120_000,
    });

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle(/Arkadii Quest/);
    await expect(page.locator("#renderCanvas")).toHaveAttribute("aria-describedby", /gameInstructions/);
    await expect(page.locator("#touchControls")).toBeHidden();
    await expect(page.locator("#onboardingOverlay")).toBeVisible();
    await expect(page.locator("#onboardingTitle")).toContainText("Arkadia");
    await expect(page.locator(".control-grid--keyboard")).toContainText("WASD");
    await expect(page.locator(".control-grid--keyboard")).toContainText("1–9");
    await expect(page.locator(".camera-note")).toContainText(/follows/i);
    await page.locator("#onboardingStart").click();
    await expect(page.locator("#onboardingOverlay")).toBeHidden();
    await expect(page.locator("#quickGuideButton")).toBeVisible();
    await page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui.closeActivePanels());
    await page.locator("#renderCanvas").focus();

    const before = await playerPosition(page);
    await page.keyboard.down("w");
    await page.waitForTimeout(900);
    await page.keyboard.up("w");
    await page.waitForTimeout(250);
    const after = await playerPosition(page);
    expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeGreaterThan(0.05);
    await expect(page.locator('[data-tutorial-step="move"]')).toHaveClass(/is-complete/);

    const panels = ["panelInventory", "panelQuests", "panelAbilities", "panelCharacter", "panelHelp"];
    for (const [index, hotkey] of ["i", "j", "k", "c", "h"].entries()) {
        await page.locator("#renderCanvas").focus();
        await page.keyboard.press(hotkey);
        await expect.poll(() => page.evaluate((name) => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui[name].isOpen(), panels[index])).toBe(true);
        await page.keyboard.press("Escape");
        await expect.poll(() => page.evaluate((name) => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui[name].isOpen(), panels[index])).toBe(false);
    }

    await page.evaluate(() => {
        const app = (window as any).__ARKADII_QUEST_APP__;
        app.__sent = [];
        const original = app.game.sendMessage.bind(app.game);
        app.game.sendMessage = (type: unknown, data: Record<string, unknown> = {}) => {
            app.__sent.push({ type, data });
            return original(type, data);
        };
    });
    await page.locator("#renderCanvas").focus();
    await page.keyboard.press("1");
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.__sent.some((entry: any) => entry.data?.digit === 1))).toBe(true);

    await page.keyboard.press("Tab");
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__ARKADII_QUEST_APP__.game.selectedEntity))).toBe(true);

    await page.evaluate(() => {
        const app = (window as any).__ARKADII_QUEST_APP__;
        const player = app.game.gamescene._currentPlayer;
        app.__originalInteract = player.interactWithNearest;
        app.__interactionCount = 0;
        player.interactWithNearest = () => {
            app.__interactionCount += 1;
            return false;
        };
    });
    await page.keyboard.press("e");
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.__interactionCount)).toBe(1);
    await page.evaluate(() => {
        const app = (window as any).__ARKADII_QUEST_APP__;
        app.game.gamescene._currentPlayer.interactWithNearest = app.__originalInteract;
    });

    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui._ChatBox.isFocused())).toBe(true);
    await page.keyboard.type("keyboard e2e");
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui._ChatBox.isFocused())).toBe(false);

    const cameraBefore = await page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.deltaCamY);
    await page.mouse.move(850, 450);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(970, 450, { steps: 8 });
    await page.mouse.up({ button: "right" });
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.deltaCamY)).toBe(cameraBefore);

    const fovBefore = await page.evaluate(
        () => (window as any).__ARKADII_QUEST_APP__.game.gamescene._currentPlayer.cameraController.camera.fov
    );
    await page.mouse.wheel(0, -120);
    await expect
        .poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._currentPlayer.cameraController.camera.fov))
        .toBe(fovBefore);

    await page.keyboard.press("F1");
    await expect(page.locator("#onboardingOverlay")).toBeVisible();
    await expect(page.locator("#tutorialProgress")).toContainText("3 / 3");
    await page.keyboard.press("Escape");
    await expect(page.locator("#onboardingOverlay")).toBeHidden();

    expect(runtimeErrors).toEqual([]);
});

test("touch controls drive the localized mobile game", async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== "touch-chromium");
    const runtimeErrors = monitorRuntimeErrors(page);

    await page.goto("/");
    await page.locator('input[name="locale"][value="ru"]').check();
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.locator("#entrySetupTitle")).toContainText("Выберите");
    await page.locator('input[name="controlMode"][value="touch"]').check();
    await page.locator("#entrySetupForm button[type=submit]").click();
    await expect
        .poll(() => page.evaluate(() => [localStorage.getItem("arkadii_quest_locale"), localStorage.getItem("arkadii_quest_control_mode")]))
        .toEqual(["ru", "touch"]);
    await page.waitForFunction(() => (window as any).__ARKADII_QUEST_APP__?.game?.gamescene?.playerIsSpawned === true, null, {
        timeout: 120_000,
    });

    await expect(page).toHaveTitle(/Аркадия Квест/);
    await expect(page.locator("#onboardingOverlay")).toBeVisible();
    await expect(page.locator("#touchControls")).toBeHidden();
    await expect(page.locator("#onboardingTitle")).toContainText("Аркадию");
    await expect(page.locator(".control-grid--touch")).toBeVisible();
    await page.locator("#onboardingStart").tap();
    await expect(page.locator("#onboardingOverlay")).toBeHidden();
    await expect(page.locator("#touchControls")).toBeVisible();
    await expect(page.locator("#touchInteractButton")).toHaveAttribute("aria-label", /Взаимодействовать/);
    await expect(page.locator("#touchTargetButton")).toHaveAttribute("aria-label", /цель/i);
    await expect(page.locator("#touchZoomInButton, #touchZoomOutButton")).toHaveCount(0);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(412);

    const cdp = await context.newCDPSession(page);
    const joystick = await page.locator("#touchJoystick").boundingBox();
    expect(joystick).not.toBeNull();
    const joystickCenter = center(joystick!);
    const before = await playerPosition(page);
    await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ ...joystickCenter, id: 11, radiusX: 5, radiusY: 5, force: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
            {
                x: joystickCenter.x + joystick!.width * 0.28,
                y: joystickCenter.y - joystick!.height * 0.28,
                id: 11,
                radiusX: 5,
                radiusY: 5,
                force: 1,
            },
        ],
    });
    await page.waitForTimeout(900);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(250);
    const after = await playerPosition(page);
    expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeGreaterThan(0.05);
    await expect.poll(() =>
        page.evaluate(() => {
            const input = (window as any).__ARKADII_QUEST_APP__.game.gamescene._input;
            return !input.player_can_move && input.horizontal === 0 && input.vertical === 0;
        })
    ).toBe(true);

    const cameraState = await page.evaluate(() => {
        const app = (window as any).__ARKADII_QUEST_APP__;
        const camera = app.game.gamescene._currentPlayer.cameraController;
        return {
            yaw: app.game.deltaCamY,
            targetDistance: camera._camRoot.position.subtract(app.game.gamescene._currentPlayer.position).length(),
        };
    });
    expect(cameraState.yaw).toBe(2.7);
    expect(cameraState.targetDistance).toBeLessThan(5);

    await page.locator("#touchTargetButton").tap();
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.selectedEntity?.name ?? "")).toMatch(/[А-Яа-яЁё]/);

    await page.evaluate(() => {
        const app = (window as any).__ARKADII_QUEST_APP__;
        const player = app.game.gamescene._currentPlayer;
        app.__originalInteract = player.interactWithNearest;
        app.__interactionCount = 0;
        player.interactWithNearest = () => {
            app.__interactionCount += 1;
            return false;
        };
    });
    await page.locator("#touchInteractButton").tap();
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.__interactionCount)).toBe(1);
    await page.evaluate(() => {
        const app = (window as any).__ARKADII_QUEST_APP__;
        app.game.gamescene._currentPlayer.interactWithNearest = app.__originalInteract;
    });

    await page.locator("#quickGuideButton").tap();
    await expect(page.locator("#onboardingOverlay")).toBeVisible();
    await expect(page.locator("#tutorialProgress")).toContainText("3 / 3");
    await page.locator("#onboardingLater").tap();

    await page.evaluate(() => {
        const app = (window as any).__ARKADII_QUEST_APP__;
        app.__sent = [];
        const original = app.game.sendMessage.bind(app.game);
        app.game.sendMessage = (type: unknown, data: Record<string, unknown> = {}) => {
            app.__sent.push({ type, data });
            return original(type, data);
        };
    });
    const hotbar = await guiControlBox(page, "hotbar");
    expect(hotbar.width).toBeGreaterThanOrEqual(43);
    expect(hotbar.height).toBeGreaterThanOrEqual(43);
    await page.touchscreen.tap(center(hotbar).x, center(hotbar).y);
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.__sent.some((entry: any) => entry.data?.digit === 1))).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui._Tooltip.tooltipContainer.isVisible)).toBe(false);

    const menu = await guiControlBox(page, "character-menu");
    expect(menu.width).toBeGreaterThanOrEqual(43);
    await page.touchscreen.tap(center(menu).x, center(menu).y);
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui.panelCharacter.isOpen())).toBe(true);
    const panel = await guiControlBox(page, "character-panel");
    const close = await guiControlBox(page, "panel-close");
    expect(panel.x).toBeGreaterThanOrEqual(-1);
    expect(panel.y).toBeGreaterThanOrEqual(-1);
    expect(panel.x + panel.width).toBeLessThanOrEqual(413);
    expect(panel.y + panel.height).toBeLessThanOrEqual(916);
    expect(close.width).toBeGreaterThanOrEqual(42);
    await expect(page.locator("#touchControls")).toBeHidden();
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui._HotBar._abilityUI.isVisible)).toBe(false);
    await page.touchscreen.tap(center(close).x, center(close).y);
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui.panelCharacter.isOpen())).toBe(false);

    await page.locator("#touchChatButton").tap();
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui._ChatBox.isFocused())).toBe(true);
    await expect.poll(() =>
        page.evaluate(() => {
            const input = (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui._ChatBox._chatInput;
            const texture = (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui.MAIN_ADT;
            return input._currentMeasure.height * (innerHeight / texture.getSize().height);
        })
    ).toBeGreaterThanOrEqual(43);

    await page.setViewportSize({ width: 915, height: 412 });
    await page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui._ChatBox.setVisible(false));
    await expect
        .poll(() =>
            page.evaluate(() => {
                const app = (window as any).__ARKADII_QUEST_APP__;
                const size = app.game.gamescene._ui.MAIN_ADT.getSize();
                const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
                return size.width > size.height && canvas.clientWidth > canvas.clientHeight;
            })
        )
        .toBe(true);

    const landscapeMenu = await guiControlBox(page, "character-menu");
    await page.touchscreen.tap(center(landscapeMenu).x, center(landscapeMenu).y);
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui.panelCharacter.isOpen())).toBe(true);
    await expect
        .poll(async () => {
            const box = await guiControlBox(page, "character-panel");
            return box.x >= -1 && box.y >= -1 && box.x + box.width <= 916 && box.y + box.height <= 413;
        })
        .toBe(true);
    const landscapePanel = await guiControlBox(page, "character-panel");
    const landscapeClose = await guiControlBox(page, "panel-close");
    expect(landscapePanel.x).toBeGreaterThanOrEqual(-1);
    expect(landscapePanel.y).toBeGreaterThanOrEqual(-1);
    expect(landscapePanel.x + landscapePanel.width).toBeLessThanOrEqual(916);
    expect(landscapePanel.y + landscapePanel.height).toBeLessThanOrEqual(413);
    await expect(page.locator("#touchControls")).toBeHidden();
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui._HotBar._abilityUI.isVisible)).toBe(false);
    await page.touchscreen.tap(center(landscapeClose).x, center(landscapeClose).y);
    await expect.poll(() => page.evaluate(() => (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui.panelCharacter.isOpen())).toBe(false);

    const landscape = await page.evaluate(() => {
        const ui = (window as any).__ARKADII_QUEST_APP__.game.gamescene._ui;
        const texture = ui.MAIN_ADT;
        const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
        const canvasBox = canvas.getBoundingClientRect();
        const textureSize = texture.getSize();
        const box = (control: any): Box => ({
            x: control._currentMeasure.left * (canvasBox.width / textureSize.width),
            y: control._currentMeasure.top * (canvasBox.height / textureSize.height),
            width: control._currentMeasure.width * (canvasBox.width / textureSize.width),
            height: control._currentMeasure.height * (canvasBox.height / textureSize.height),
        });
        const domBox = (element: Element): Box => {
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        };
        return {
            hotbar: box(ui._HotBar._abilityUI),
            joystick: domBox(document.querySelector("#touchJoystick")!),
            actions: domBox(document.querySelector(".touch-actions")!),
        };
    });
    expect(overlapArea(landscape.hotbar, landscape.joystick)).toBe(0);
    expect(overlapArea(landscape.hotbar, landscape.actions)).toBe(0);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(915);

    expect(runtimeErrors).toEqual([]);
});
