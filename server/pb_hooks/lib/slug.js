// Shared helper for hooks. Hook handlers run in isolated VMs, so anything they share must be
// loaded with `require(`${__hooks}/lib/slug.js`)` inside the handler.
module.exports = {
  slugify(input) {
    const base = String(input || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    return base || "post";
  },
};
