const isLocal = function () {
    return ["localhost:8080", "127.0.0.1:8080"].includes(window.location.host);
};

const clientBasePath = function () {
    const configured = process.env.CLIENT_BASE_PATH || "";
    const normalized = configured.replace(/^\/+|\/+$/g, "");
    return normalized ? "/" + normalized : "";
};

const assetUrl = function (path: string) {
    const cleanPath = path.replace(/^\/+/, "");
    const basePath = clientBasePath();
    return basePath ? basePath + "/" + cleanPath : "./" + cleanPath;
};

const apiUrl = function (port) {
    if (process.env.CLIENT_API_URL) {
        return process.env.CLIENT_API_URL;
    }

    if (process.env.NODE_ENV !== "production" && isLocal()) {
        return "http://localhost:" + port;
    }

    return window.location.origin + clientBasePath();
};

const websocketUrl = function (port) {
    if (process.env.CLIENT_WS_URL) {
        return process.env.CLIENT_WS_URL;
    }

    if (process.env.NODE_ENV !== "production" && isLocal()) {
        return "ws://localhost:" + port;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return protocol + "//" + window.location.host + clientBasePath();
};

export { isLocal, clientBasePath, assetUrl, apiUrl, websocketUrl };
