export const accelerationText=n=>(n>=0?"+":"")+n.toFixed(2)+" m/s² · "+(n>=0?"+":"")+(n/9.80665).toFixed(2)+" g";
export const formatTime=n=>n==null?"—":n.toFixed(3)+" s";
export const motionNames=["Ground driving","Lifting off","Flight","Landing","Suspension jump"];
