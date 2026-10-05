const yaml = require("js-yaml");
const { DateTime } = require("luxon");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const htmlmin = require("html-minifier");

module.exports = function (eleventyConfig) {

  eleventyConfig.addPassthroughCopy("./src/static/css");
  eleventyConfig.addPassthroughCopy("./src/static/js");
  eleventyConfig.addPassthroughCopy("./src/static/vid");

  // Disable automatic use of your .gitignore
  eleventyConfig.setUseGitIgnore(false);

  // Merge data instead of overriding
  eleventyConfig.setDataDeepMerge(true);

  // human readable date
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(
      "dd LLL yyyy"
    );
  });

  // Syntax Highlighting for Code blocks
  eleventyConfig.addPlugin(syntaxHighlight);

  // To Support .yaml Extension in _data
  // You may remove this if you can use JSON
  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));

  // Copy Static Files to /_Site
  eleventyConfig.addPassthroughCopy({
    "./src/admin/config.yml": "./admin/config.yml",
    "./node_modules/alpinejs/dist/cdn.min.js": "./static/js/alpine.js",
    "./node_modules/prismjs/themes/prism-tomorrow.css":
      "./static/css/prism-tomorrow.css",
  });

  // Copy Image Folder to /_site
  eleventyConfig.addPassthroughCopy("./src/static/img");

  // Copy favicon to route of /_site
  eleventyConfig.addPassthroughCopy("./src/favicon.ico");

  // Publish the YCC 2026 post-event report assets at /convening-post-event-2026/
  // index.html is intentionally excluded: it is rendered as a template so the
  // blank-custom layout supplies the document head. Copying it here would
  // overwrite the rendered page and strip every SEO tag.
  eleventyConfig.addPassthroughCopy({
    "./src/_includes/reports/ycc26/assets": "./convening-post-event-2026/assets",
    "./src/_includes/reports/ycc26/styles.css": "./convening-post-event-2026/styles.css",
    "./src/_includes/reports/ycc26/script.js": "./convening-post-event-2026/script.js",
    "./src/_includes/reports/ycc26/pdf-viewer.js": "./convening-post-event-2026/pdf-viewer.js",
    "./src/_includes/reports/ycc26/handbook.pdf": "./convening-post-event-2026/handbook.pdf",
    "./src/_includes/reports/ycc26/favicon.ico": "./convening-post-event-2026/favicon.ico",
  });

  // Minify HTML
  eleventyConfig.addTransform("htmlmin", function (content, outputPath) {
    // Eleventy 1.0+: use this.inputPath and this.outputPath instead
    if (outputPath.endsWith(".html")) {
      let minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
      });
      return minified;
    }

    return content;
  });

  // Let Eleventy transform HTML files as nunjucks
  // So that we can use .html instead of .njk
  return {
    dir: {
      input: "src",
    },
    htmlTemplateEngine: "njk",
  };
};
