const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge(common, {
    mode: "production",
    // Do not publish the full TypeScript source tree alongside the browser bundle.
    devtool: false,
});
