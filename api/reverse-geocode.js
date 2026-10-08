function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'method_not_allowed' });
  }

  const latitude = Number(req.query?.lat);
  const longitude = Number(req.query?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return send(res, 400, { error: 'invalid_coordinates' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', '18');
    url.searchParams.set('accept-language', 'ar,en');
    url.searchParams.set('lat', latitude.toFixed(7));
    url.searchParams.set('lon', longitude.toFixed(7));
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BariqGifts/1.0 (info@bariqgifts.com)',
      },
    });
    if (!response.ok) return send(res, 502, { error: 'address_lookup_failed' });
    const data = await response.json();
    return send(res, 200, data);
  } catch (error) {
    return send(res, 502, { error: error?.name === 'AbortError' ? 'address_lookup_timeout' : 'address_lookup_failed' });
  } finally {
    clearTimeout(timeout);
  }
}
