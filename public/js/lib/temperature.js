// Display conversion only. Original NASA data, exports and screening remain °C.
export const temperatureValue=(value,unit='C')=>value==null?null:unit==='F'?value*9/5+32:value;
export const temperatureLabel=(unit='C')=>unit==='F'?'°F':'°C';
