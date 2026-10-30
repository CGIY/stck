export function isAllowedEndpoint(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.hash &&
      u.pathname.length > 1 &&
      (u.hostname === "fcm.googleapis.com" ||
        u.hostname === "updates.push.services.mozilla.com" ||
        u.hostname === "web.push.apple.com" ||
        /^[a-z0-9-]+\.push\.apple\.com$/.test(u.hostname))
    );
  } catch {
    return false;
  }
}
export function constantTimeEqual(a, b) {
  const left = new TextEncoder().encode(a),
    right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++)
    diff |= (left[i] || 0) ^ (right[i] || 0);
  return diff === 0;
}
