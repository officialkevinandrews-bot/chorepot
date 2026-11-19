import {describe,it,expect} from 'vitest';
import {money,demoAction,balance,demo} from '../features/family/model';
describe('Pocket money rules',()=>{
 it('supports GBP pence',()=>expect(money(50)).toBe('50p'));
 it('supports GBP pounds',()=>expect(money(250)).toBe('£2.50'));
 it('completion does not award money',()=>expect(balance(demoAction(demo.state,'complete',{id:'3'}),'oliver')).toBe(2250));
 it('parent approval awards the bounty once',()=>{const s=demoAction(demo.state,'approve',{id:'1'});expect(balance(s,'oliver')).toBe(2400);expect(balance(demoAction(s,'approve',{id:'1'}),'oliver')).toBe(2400);});
 it('marking as paid settles the virtual balance',()=>expect(balance(demoAction(demo.state,'pay',{childId:'oliver'}),'oliver')).toBe(0));
 it('cannot allocate beyond balance',()=>expect(()=>demoAction(demo.state,'allocate',{id:'g1',amount:99999})).toThrow());
});
