import si from "systeminformation";

si.cpu().then(data=>console.log(data)).catch(err=>console.log(err));