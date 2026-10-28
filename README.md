# Buscaminas Power

Juego incremental de Buscaminas para navegador, sin instalación ni dependencias de ejecución. Abre `index.html` o sirve esta carpeta con `python -m http.server`.

Las reglas de progresión y las ideas pendientes están en [GAME-DESIGN.md](GAME-DESIGN.md). El progreso se guarda en el navegador.

Para ejecutar las pruebas: `node --test tests/progression-and-bots.test.js`.

En móvil, elige **Abrir** o **Bandera** antes de tocar el tablero. Con Visión X activa, tocar inspecciona una casilla sin abrirla. Los tableros grandes se pueden desplazar. **Nueva partida** reinicia el tablero; en **Opciones → Nueva sesión** puedes reiniciar todo el progreso tras confirmar.

En **Recarga de turbo**, pulsa «Cargar» para reducir la espera y «Activar turbo gratis» cuando esté listo. Los clics no dan monedas; las mejoras previas del extractor ahora aumentan el tiempo que ahorras por clic.
