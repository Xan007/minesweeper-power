# Buscaminas Power: dirección de juego

La partida manual debe ser interesante por sí misma: leer pistas, decidir si arriesgar, usar poderes en momentos tensos y recibir una recompensa clara. Los bots acompañan esa partida y generan recursos mientras la página está abierta.

## Recorrido actual

1. **Primeros minutos:** el primer clic es seguro; el jugador conoce el tablero, las banderas y los cuatro poderes. Un bot y monedas iniciales permiten probar las primeras mejoras.
2. **Desarrollo:** invertir en velocidad, análisis y habilidades de bots; elegir dificultades y combinar los poderes del jugador. Los bonos de tiempo y de minas sin bandera ofrecen maneras distintas de resolver.
3. **Después de las primeras mejoras:** los contratos diarios proponen ganar, hacerlo dentro del tiempo de cada dificultad y ganar sin poderes. Los contratos y rangos cuentan partidas clásicas para que un tablero personalizado mínimo no los trivialice.
4. **Largo plazo:** cada tres victorias clásicas se obtiene un rango y una recompensa creciente. La refinería tiene 20 niveles y aumenta las recompensas de victoria manual; no reinicia las mejoras existentes. Los contratos se renuevan según la fecha local.

## Equilibrio y continuidad

- El bono por velocidad y el de minas sin bandera son opcionales: usar banderas o poderes sigue siendo una estrategia válida.
- Los contratos se abonan automáticamente, una sola vez por día, y una victoria puede cumplir varios. Sus recompensas y las del rango aparecen en el resultado.
- Las partidas personalizadas mantienen recompensas normales, pero no cuentan para contratos ni rango. Los datos antiguos conservan sus mejoras; su número de victorias se utiliza como aproximación inicial para el rango.
- La refinería afecta solo a la recompensa base y sus bonos de victoria manual; no multiplica contratos ni recompensas de rango.
- Los bots no siguen generando monedas con la página cerrada. No hay prestigio ni pérdida de progreso.

## Próximas oportunidades

Estas ideas son propuestas, no funciones implementadas: desafíos semanales con reglas rotativas y tableros reproducibles, logros con recompensas cosméticas, modos especiales con modificadores y más inversiones para las etapas avanzadas. Conviene validar primero los tiempos y las recompensas con partidas reales para que las nuevas metas no se conviertan en una obligación diaria.
