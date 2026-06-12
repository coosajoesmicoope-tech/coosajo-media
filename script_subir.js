require('dotenv').config();
const { execSync } = require('child_process');

console.log("🛠️ Fabricando instalador para Windows (x64) y subiendo a GitHub...");

if (!process.env.GH_TOKEN || process.env.GH_TOKEN.includes("Pega_Tu_Llave_Aca")) {
    console.error("❌ ERROR: No has pegado tu Llave Maestra en el archivo .env");
    console.error("Por favor, entra a GitHub, genera un Classic Token con permisos 'repo', pégalo en .env y vuelve a intentar.");
    process.exit(1);
}

try {
    // --publish always sube el .exe y el latest.yml a GitHub Releases automáticamente
    execSync('npx electron-builder --win --x64 --publish always', { stdio: 'inherit' });
    console.log("==========================================");
    console.log("🎉 ¡ACTUALIZACIÓN PUBLICADA CON ÉXITO EN GITHUB!");
    console.log("Todas las pantallas con Windows descargaran silenciosamente esta nueva versión.");
    console.log("==========================================");
} catch (e) {
    console.error("❌ Error al fabricar o subir a GitHub.");
    process.exit(1);
}
