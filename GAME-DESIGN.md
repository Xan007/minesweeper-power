# Buscaminas Power: dirección de juego

La partida manual debe ser interesante por sí misma: leer pistas, decidir si arriesgar, usar poderes en momentos tensos y recibir una recompensa clara. Los bots acompañan esa partida y generan recursos mientras la página está abierta.

La estación de extracción permite obtener monedas continuamente con clics. Los clics seguidos elevan el combo hasta ×5; cada 25 clics se cobra una descarga y los bots activos reciben 1,5× de velocidad durante ocho segundos. La potencia se puede mejorar hasta el nivel 100 y se duplica cada diez niveles. La carga y las mejoras se guardan; el combo y el impulso temporal se reinician al recargar.

El Consejero señala una jugada deducible y dibuja un cursor auxiliar de estilo clásico; el puntero del sistema permanece bajo el control del jugador. Hay tres pistas por partida y pueden ampliarse en el Cuartel. Una bandera incorrecta, una celda congelada o la ausencia de una deducción hacen que avise sin consumir una pista. Usar el Consejero cuenta como usar un poder para los contratos.

## Recorrido actual

1. **Primeros minutos:** el primer clic es seguro; el jugador conoce el tablero, las banderas y los cuatro poderes. Un bot y monedas iniciales permiten probar las primeras mejoras.
2. **Desarrollo:** invertir en velocidad, análisis y habilidades de bots; elegir dificultades y combinar los poderes del jugador. Los bonos de tiempo y de minas sin bandera ofrecen maneras distintas de resolver.
3. **Después de las primeras mejoras:** los contratos diarios proponen ganar, hacerlo dentro del tiempo de cada dificultad y ganar sin poderes. Los contratos y rangos cuentan partidas clásicas para que un tablero personalizado mínimo no los trivialice.
4. **Largo plazo:** cada tres victorias clásicas se obtiene un rango y una recompensa creciente. La refinería tiene 20 niveles y aumenta las recompensas de victoria manual. Ganar en experto acumula una racha y un bono adicional de 10% por victoria, hasta 150%; perder en experto la reinicia.
5. **Escuadrón:** con dos bots contratados se desbloquean operaciones repetibles. Cada victoria aporta progreso y un escaneo compartido, hasta seis; solo otro bot puede gastarlo cuando no tiene una deducción segura. Cada operación da monedas y la siguiente requiere más victorias, hasta un máximo de doce. Es una colaboración automática entre tableros, no multijugador.

## Equilibrio y continuidad

- El bono por velocidad y el de minas sin bandera son opcionales: usar banderas o poderes sigue siendo una estrategia válida.
- Los contratos se abonan automáticamente, una sola vez por día, y una victoria puede cumplir varios. Sus recompensas y las del rango aparecen en el resultado.
- Las partidas personalizadas mantienen recompensas normales, pero no cuentan para contratos ni rango. Los datos antiguos conservan sus mejoras; su número de victorias se utiliza como aproximación inicial para el rango.
- La refinería y la racha experta afectan a la recompensa de victoria manual; no multiplican contratos ni recompensas de rango.
- Los bots no siguen generando monedas con la página cerrada. No hay prestigio ni pérdida de progreso.

## Próximas oportunidades

Estas ideas son propuestas, no funciones implementadas: desafíos semanales con reglas rotativas y tableros reproducibles, logros con recompensas cosméticas y modos especiales con modificadores. Una posible expansión es un campo conectado donde los bots resuelvan zonas del mismo mapa y transfieran pistas en sus fronteras. Conviene validar primero los tiempos y recompensas con partidas reales.
