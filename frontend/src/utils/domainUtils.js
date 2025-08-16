// src/utils/domainUtils.js

export function getSubdomain() {
  const hostname = window.location.hostname; // e.g. company1.example.com
  const parts = hostname.split(".");
  if (parts.length > 2) return parts[0];
  return null;
}

export async function verifySubdomain(subdomain) {
  if (!subdomain) return { valid: false };

  try {
    const res = await fetch(`/api/check-subdomain?subdomain=${subdomain}`);
    if (!res.ok) return { valid: false };

    const data = await res.json();
    return data; // Expected: { valid: true, companyId: 'abc123' } or { valid: false }
  } catch (error) {
    console.error("Error verifying subdomain:", error);
    return { valid: false };
  }
}
