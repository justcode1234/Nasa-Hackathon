// Display scaling only; scientific monthly aggregation stays in the shared adapter.
export function columnData(data,month){
  if(!Number.isInteger(month)||month<1||month>12)throw new Error('Choose a month from 1 to 12.');
  const maximum=Math.max(0,...data.cells.flatMap(cell=>cell.monthly.map(summary=>summary.sum??0)));
  const metresPerMm=20_000/Math.max(1,maximum);
  const features=data.cells.map(cell=>{const summary=cell.monthly[month-1];return{
    type:'Feature',id:cell.id,geometry:cell.geometry,properties:{cellId:cell.id,value:summary.sum,
      height:summary.sum===null?0:summary.sum*metresPerMm,missing:summary.sum===null,partial:summary.partial,selected:cell.id===data.selectedCellId}};
  });
  return{maximum,metresPerMm,features};
}
