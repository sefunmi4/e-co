import next from "eslint-config-next";

export default [
  ...next,
  {
    ignores: ["src/lib/proto"],
  },
];
