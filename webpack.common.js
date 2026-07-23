const path = require("path");
const fs = require("fs");
const appDirectory = fs.realpathSync(process.cwd());
const CopyPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");
require("dotenv").config();

module.exports = {
    entry: path.resolve(appDirectory, "src/client/index.ts"),
    output: {
        filename: "js/bundle.js",
        clean: true,
        path: path.resolve(__dirname, "dist/client"),
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        fallback: {
            console: false,
            assert: false,
            util: false,
        },
        alias: {
            "@shared": path.resolve(__dirname, "../src/shared"),
        },
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: "ts-loader",
                    options: {
                        //sourceMap: true,
                    },
                },
            },
        ],
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: "public/", to: "./" },
                { from: "docs/", to: "docs/content/" },
            ],
        }),
        new webpack.DefinePlugin({
            "process.env.APP_PORT": JSON.stringify(process.env.APP_PORT || "3000"),
            "process.env.APP_DATABASE": JSON.stringify(process.env.APP_DATABASE || "mysql"),
            "process.env.CLIENT_API_URL": JSON.stringify(process.env.CLIENT_API_URL || ""),
            "process.env.CLIENT_WS_URL": JSON.stringify(process.env.CLIENT_WS_URL || ""),
            "process.env.CLIENT_BASE_PATH": JSON.stringify(process.env.CLIENT_BASE_PATH || ""),
        }),
    ],
    mode: "development",
};
