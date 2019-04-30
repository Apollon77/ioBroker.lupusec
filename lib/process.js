'use strict';

/**
 * if function called async
 * @param {function} funct - function to check
 */
function isAsync(funct) {
  if (funct && funct.constructor) return funct.constructor.name == 'AsyncFunction';
  return undefined;
}


class Process {

  constructor(adapter) {
    this.setPollSec(adapter.config.alarm_polltime || 1);
    this.processes = [];
    this.timeoutid = undefined;
    this.adapter = adapter;
    this.setError(false);
    this.keycnt = 1000;
  }

  /** 
   * Seconds to next poll
   */
  getPollSec() {
    return this.pollsec;
  }

  /** 
  * Seconds to next poll
  */
  setPollSec(pollsec) {
    this.pollsec = pollsec;
  }

  setError(error) {
    this.error = error;
  }

  getError() {
    return this.error;
  }

  /**
     * Add process to array
     * @param {function} funct - function to add to queue
     * @param {string} key - identifier for added function to process. 
     * @param {number} prio - priority, 1 ist highest, 99 lowest. No value is equal to 99
     * @param {boolen} loop - if true, after proccessing the function will add to queue again
     */
  async addToProcess(funct, key, prio, loop) {
    let unixtime = Math.round((new Date()).getTime());
    if (typeof key === 'boolean') {
      loop = key;
      prio = undefined;
      key = 'KEY' + this.keycnt++;
    }
    if (typeof key === 'number') {
      loop = prio;
      prio = key;
      key = undefined;
    }
    if (typeof prio === 'boolean') {
      loop = prio;
      prio = undefined;
    }
    if (!prio || prio < 1 || prio > 99) prio = 99;
    if (!loop) loop = false;
    for (let i = 0; i < this.processes.length; i++) {
      if (key && this.processes[i].key === key) {
        this.processes[i] = {
          key: key,
          prio: prio,
          funct: funct,
          loop: loop,
          ts: unixtime
        };
        if (i === 0 && prio === 1 && !this.getError()) {
          await this.startProcess();
        }
        return;
      }
      if (this.processes[i].prio > prio) {
        let tmp = [];
        this.processes = tmp.concat(this.processes.slice(0, i), {
          key: key,
          prio: prio,
          funct: funct,
          loop: loop,
          ts: unixtime
        }, this.processes.slice(i));
        // if prio 1, start processes immediately
        // if (prio == 1 && this.timeoutid && !this.error) {
        if (i === 0 && prio === 1 && !this.getError()) {
          await this.startProcess();
        }
        return;
      }
    }
    this.processes.push({
      key: key,
      prio: prio,
      funct: funct,
      loop: loop,
      ts: unixtime
    });
  }

  /**
   * avaluate process
   */
  async startProcess() {
    this.adapter.log.debug('Process Queue: ' + JSON.stringify(this.processes));
    if (!this.getError()) {
      if (this.timeoutid) {
        // clear running timeouts
        clearTimeout(this.timeoutid);
        this.timeoutid = null;
      }
      let process = this.processes.shift();
      if (process) {
        if (process.funct) {
          this.adapter.log.debug('Prio: ' + process.prio + ', Function: ' + process.funct + ', Time: ' + new Date(process.ts).toISOString() + ', Now: ' + new Date().toISOString());
          this.adapter.log.debug('Process: ' + JSON.stringify(process));
          try {
            let result = isAsync(process.funct) ? await process.funct() : process.funct();
          } catch (error) {
            this.adapter.log.error('could not procces functions in startProcess: ' + error);
          }
        }
        if (process.loop) {
          await this.addToProcess(process.funct, process.key, process.prio, process.loop);
        }
      }
    }
    this.timeoutid = setTimeout(async () => {
      await this.startProcess();
    }, this.getPollSec() * 1000);
  }
}

module.exports = {
  Process: Process
};