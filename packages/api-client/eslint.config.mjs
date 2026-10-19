import base from "@kriraghor/config/eslint";

// Packages have no pages/ folder, so the Next rule that looks for one is off.
const config = [...base, { rules: { "@next/next/no-html-link-for-pages": "off" } }];

export default config;
