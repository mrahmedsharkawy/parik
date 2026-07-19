const fs = require('fs');

function replaceOnce(file, oldText, newText) {
  const text = fs.readFileSync(file, 'utf8');
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${file}: expected 1 match, found ${count}`);
  fs.writeFileSync(file, text.replace(oldText, newText), 'utf8');
}

const stale = String.raw`(?:google\.[^/]+\/maps|maps\.google|goo\.gl\/maps|^https?:\/\/|@?-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+)`;

replaceOnce(
  'java/Products.js',
  'customerAddress=[af.street,af.building,af.area,af.city].filter(Boolean).join("، ")||prof.address||""',
  `customerAddress=[af.street,af.building,af.area,af.city].filter(Boolean).join("، ")||prof.address||"";if(/${stale}/i.test(customerAddress)){customerAddress=[af.city,af.area,af.state].filter(Boolean).join("، ")||"";if(prof.address&&/${stale}/i.test(prof.address)){prof.address=customerAddress;localStorage.setItem("x2_profile",JSON.stringify(prof))}}`
);

replaceOnce('java/Products.js', 'prof.address=prof.address||area;', 'prof.address=area;');

replaceOnce(
  'java/Cart.js',
  'address:(shipping.address||[profile.address_full&&profile.address_full.street,profile.address_full&&profile.address_full.building,profile.address_full&&profile.address_full.area].filter(Boolean).join("، ")||profile.address||opts.customerAddressFallback||"").trim()',
  `address:(function(){let address=shipping.address||[profile.address_full&&profile.address_full.street,profile.address_full&&profile.address_full.building,profile.address_full&&profile.address_full.area,profile.address_full&&profile.address_full.city].filter(Boolean).join("، ")||profile.address||opts.customerAddressFallback||"";if(/${stale}/i.test(address))address=[profile.address_full&&profile.address_full.city,profile.address_full&&profile.address_full.area].filter(Boolean).join("، ")||opts.customerAddressFallback||"";return address})().trim()`
);

replaceOnce(
  'java/Cart.js',
  'const saved=[prof.address_full&&prof.address_full.street,prof.address_full&&prof.address_full.building,prof.address_full&&prof.address_full.area].filter(Boolean).join("، ")||prof.address||"";',
  `let saved=[prof.address_full&&prof.address_full.street,prof.address_full&&prof.address_full.building,prof.address_full&&prof.address_full.area,prof.address_full&&prof.address_full.city].filter(Boolean).join("، ")||prof.address||"";if(/${stale}/i.test(saved)){saved=[prof.address_full&&prof.address_full.city,prof.address_full&&prof.address_full.area].filter(Boolean).join("، ")||"";if(prof.address&&/${stale}/i.test(prof.address)){prof.address=saved;localStorage.setItem("x2_profile",JSON.stringify(prof))}}`
);

replaceOnce('java/Cart.js', 'prof.address=prof.address||area;', 'prof.address=area;');

console.log('Sanitized stale saved map-address handling.');
