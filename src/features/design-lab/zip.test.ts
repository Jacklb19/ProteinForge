import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {Blob} from 'node:buffer';
import {DecompressionStream} from 'node:stream/web';
import {zipFixture} from '../../test/design-lab-fixtures';
import {crc32,readZip,safePath} from './zip';
import {LAB_CONFIG as C,required} from './config';

beforeEach(()=>{vi.stubGlobal('Blob',Blob);vi.stubGlobal('DecompressionStream',DecompressionStream);});afterEach(()=>{vi.unstubAllGlobals();});
describe('bounded archive reader',()=>{
  const content=new TextEncoder().encode('123456789');
  it('matches the published CRC32 check vector',()=>{expect(crc32(content)).toBe(0xcbf43926);});
  it.each([0,8] as const)('reads method %i with size and independent CRC checks',async method=>{const files=await readZip(zipFixture([['result.txt',content]],{method}));expect(Array.from(required(files.get('result.txt')))).toEqual(Array.from(content));});
  it('accepts bounded NumPy ZIP64 local sizes without accepting ZIP64 central directories',async()=>{expect(Array.from(required((await readZip(zipFixture([['pae.npy',content]],{zip64Local:true}))).get('pae.npy')))).toEqual(Array.from(content));});
  it.each(['../escape','/absolute','a//b','a/./b','a\\b','a%2fb','C:/escape','NUL.txt','a.'])('rejects ambiguous path %s',name=>{expect(()=>{safePath(name);}).toThrow();});
  it('rejects duplicate and case-aliased names before reading their bodies',async()=>{await expect(readZip(zipFixture([['a',content],['a',content]]))).rejects.toMatchObject({code:'path'});await expect(readZip(zipFixture([['a',content],['A',content]]))).rejects.toMatchObject({code:'path'});});
  it('rejects a corrupt stored entry',async()=>{const bytes=zipFixture([['a',content]],{method:0});bytes[31]=0;await expect(readZip(bytes)).rejects.toMatchObject({code:'zip'});});
  it('rejects a forged expanded size before decompression',async()=>{const bytes=zipFixture([['a',content]]),view=new DataView(bytes.buffer),central=view.getUint32(bytes.length-6,true);view.setUint32(central+24,C.maximumEntryBytes+1,true);await expect(readZip(bytes)).rejects.toMatchObject({code:'size'});});
  it('rejects symlinks and oversized nested budgets',async()=>{await expect(readZip(zipFixture([['a',content]],{mode:0xa1ff0000}))).rejects.toMatchObject({code:'zip'});await expect(readZip(zipFixture([['a',content]]),{used:C.maximumExpandedBytes})).rejects.toMatchObject({code:'size'});});
  it('rejects unsupported compression capability explicitly',async()=>{vi.stubGlobal('DecompressionStream',function unavailable(){throw new Error('unavailable');});await expect(readZip(zipFixture([['a',content]]))).rejects.toMatchObject({code:'unsupported'});});
  it('rejects truncated or oversized containers',async()=>{await expect(readZip(new Uint8Array(5))).rejects.toThrow();await expect(readZip(new Uint8Array(C.maximumArchiveBytes+1))).rejects.toMatchObject({code:'size'});});
});
