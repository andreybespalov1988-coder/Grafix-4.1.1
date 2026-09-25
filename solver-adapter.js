'use strict';
const Engine=require('./scheduling-engine');
const {CpSatSolverAdapter}=require('./solver-cp-sat-adapter');

class HeuristicSolverAdapter{
 constructor(engine=Engine){this.engine=engine;this.name='Local Heuristic Solver';}
 solve(db,options={}){const variants=this.engine.generateVariants(db,options.seed);return {solver:this.name,variants,selected:variants.slice().sort((a,b)=>b.metrics.quality-a.metrics.quality)[0]||null};}
}

class SolverAdapter{
 constructor(local=new HeuristicSolverAdapter(),cpSat=new CpSatSolverAdapter()){this.local=local;this.cpSat=cpSat;this.external=null;}
 registerExternal(solver){if(!solver||typeof solver.solve!=='function')throw new TypeError('Solver должен реализовать solve(db, options).');this.external=solver;}
 get active(){return this.external||this.local;}
 solve(db,options={}){return this.active.solve(db,options);}
 async solveAsync(db,options={}){
   if(options.backend==='heuristic')return this.local.solve(db,options);
   if(this.external&&typeof this.external.solve==='function')return this.external.solve(db,options);
   return await this.cpSat.solve(db,{...options,solutionCount:1});
 }
 validate(db,options={}){return this.cpSat.validate(db,options);}
 async generateAlternatives(db,options={}){return this.cpSat.generateAlternatives(db,options);}
 async diagnose(db,options={}){return this.cpSat.diagnose(db,options);}
 cancel(requestId){return this.cpSat.cancel(requestId);}
}
module.exports={SolverAdapter,HeuristicSolverAdapter,CpSatSolverAdapter};
