const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: "./src/spec/extension.test.tsx",
  //   devtool: "inline-source-map",
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify("TEST"),
    }),
  ],
  devServer: {
    // static: {
    //   directory: path.join(__dirname, 'public'),
    // },
    compress: false,
    port: 9000,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers":
        "X-Requested-With, content-type, Authorization",
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
            },
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "test-bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
};
