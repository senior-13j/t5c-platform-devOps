import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const reuseExistingServer = process.env.CI !== "true";

export default defineConfig({
    testDir: "./tests/e2e",
    timeout: 180_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    workers: 1,
    reporter: [["list"], ["html", { open: "never" }]],
    use: {
        baseURL: "http://127.0.0.1:8080",
        headless: true,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "off",
        launchOptions: {
            executablePath,
            args: [
                "--no-sandbox",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--enable-unsafe-swiftshader",
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--disable-dev-shm-usage",
            ],
        },
    },
    projects: [
        {
            name: "desktop-chromium",
            use: {
                ...devices["Desktop Chrome"],
                viewport: { width: 1440, height: 900 },
                locale: "en-US",
            },
        },
        {
            name: "touch-chromium",
            use: {
                browserName: "chromium",
                viewport: { width: 412, height: 915 },
                locale: "ru-RU",
                hasTouch: true,
                isMobile: true,
            },
        },
    ],
    webServer: [
        {
            command:
                "APP_DATABASE=sqllite DATABASE_PATH=/tmp/arkadii-quest-controls-e2e.db NODE_ENV=development npm run server-start",
            url: "http://127.0.0.1:3000/load_game_data",
            timeout: 120_000,
            reuseExistingServer,
        },
        {
            command: "npx webpack serve --config webpack.dev.js --no-open",
            url: "http://127.0.0.1:8080",
            timeout: 120_000,
            reuseExistingServer,
        },
    ],
});
