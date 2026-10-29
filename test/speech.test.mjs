import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeechPlayer } from '../src/speech.js';
function setup() {
  const spoken = [], errors = [];
  let cancel = 0, paused = 0, resumed = 0;
  const player = new SpeechPlayer({
    synth: { speak:u=>spoken.push(u), cancel:()=>cancel++, pause:()=>paused++, resume:()=>resumed++ },
    Utterance:class {constructor(text){this.text=text;}},
    voice:()=>({lang:'en-US'}), rate:()=>1.5, onchange:()=>{}, onerror:e=>errors.push(e),
  });
  return {player,spoken,errors,counts:()=>({cancel,paused,resumed})};
}
const queue = ['One.','Two.','Three.'].map(text=>({text}));
test('pause/resume keeps the same utterance',()=>{
  const {player,spoken,counts}=setup();player.start(queue);player.toggle();player.toggle();
  assert.equal(spoken.length,1);assert.equal(player.state,'playing');assert.equal(counts().resumed,1);
  spoken[0].onend();assert.equal(spoken[1].text,'Two.');spoken[0].onend();assert.equal(spoken.length,2);
});
test('seek rejects stale end and error callbacks',()=>{
  const {player,spoken,errors}=setup();player.start(queue);const old=spoken[0];player.seek(2);
  old.onend();old.onerror({error:'interrupted'});assert.equal(player.index,2);assert.equal(spoken.length,2);assert.deepEqual(errors,[]);
});
test('stop invalidates callbacks',()=>{
  const {player,spoken}=setup();player.start(queue);player.stop();spoken[0].onend();assert.equal(player.state,'idle');assert.equal(spoken.length,1);
});
test('end while paused advances once on resume',()=>{
  const {player,spoken}=setup();player.start(queue);player.toggle();spoken[0].onend();spoken[0].onend();
  assert.equal(spoken.length,1);player.toggle();assert.equal(spoken.length,2);assert.equal(player.index,1);
});
test('finishing and changing speed have no implicit repeat',()=>{
  const {player,spoken}=setup();player.start(queue.slice(0,1));assert.equal(spoken[0].rate,1.5);spoken[0].onend();assert.equal(player.state,'ended');assert.equal(spoken.length,1);
});
test('missing local voice fails without using default remote voice',()=>{
  const {player,spoken,errors}=setup();player.voice=()=>undefined;player.start(queue);assert.equal(spoken.length,0);assert.equal(errors.length,1);assert.equal(player.state,'idle');
});
test('a new session does not inherit a paused end',()=>{
  const {player,spoken}=setup();player.start(queue);player.toggle();spoken[0].onend();player.start(queue);player.toggle();player.toggle();assert.equal(player.index,0);
});
