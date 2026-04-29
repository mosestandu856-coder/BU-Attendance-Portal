/**
 * Generates a self-signed cert using Node built-in crypto.
 * Writes cert.pem and key.pem to the project root.
 * Run once: node generate-cert.js
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

const ip = process.argv[2] || getLocalIP();
console.log('Generating cert for IP:', ip);

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

// Use Node's built-in cert generation (Node 22+)
// For older Node, we use a workaround via forge
try {
  // Try forge (already installed via selfsigned dependency)
  const forge = require('node-forge');
  
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + Date.now().toString(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);
  
  const attrs = [
    { name: 'commonName', value: ip },
    { name: 'organizationName', value: 'Attendance System' },
    { name: 'countryName', value: 'US' }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 7, ip: ip },
        { type: 7, ip: '127.0.0.1' },
        { type: 2, value: 'localhost' }
      ]
    }
  ]);
  
  cert.sign(keys.privateKey, forge.md.sha256.create());
  
  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  
  fs.writeFileSync('cert.pem', certPem);
  fs.writeFileSync('key.pem', keyPem);
  
  console.log('✅ cert.pem and key.pem generated successfully for IP:', ip);
  console.log('Now restart the server: node server.js');
} catch(e) {
  console.error('Failed:', e.message);
  process.exit(1);
}
