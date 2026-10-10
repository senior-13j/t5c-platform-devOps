const appPort = process.env.APP_PORT || "3000";
const requiredMetricNames = [
    "arkadii_quest_server_uptime_seconds",
    "arkadii_quest_server_memory_rss_bytes",
    "arkadii_quest_server_memory_heap_used_bytes",
    "arkadii_quest_http_requests_total",
    "arkadii_quest_http_request_duration_seconds_count",
];

async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${url} returned HTTP ${response.status}`);
    }

    return response.json();
}

async function main() {
    const metricsResponse = await fetch(`http://127.0.0.1:${appPort}/metrics`);
    if (!metricsResponse.ok) {
        throw new Error(`game metrics returned HTTP ${metricsResponse.status}`);
    }

    const metrics = await metricsResponse.text();
    const missingMetrics = requiredMetricNames.filter((name) => !metrics.includes(name));
    if (missingMetrics.length > 0) {
        throw new Error(`missing game metric(s): ${missingMetrics.join(", ")}`);
    }

    const query = new URL("http://prometheus:9090/api/v1/query");
    query.searchParams.set("query", 'up{job="arkadii-quest-server"}');
    const result = await getJson(query);
    const targetUp = result?.data?.result?.some((sample) => sample?.value?.[1] === "1");
    if (!targetUp) {
        throw new Error("Prometheus has not scraped an up Arkadii Quest server target");
    }

    console.log("Observability check passed: game metrics and Prometheus target are available.");
}

main().catch((error) => {
    console.error(`Observability check failed: ${error.message}`);
    process.exitCode = 1;
});
