import test from 'node:test';
import assert from 'node:assert/strict';
import {commercialPlans,planPricing,billingPeriod,formatPrice,planPriceLabel} from '../packages/domain/commercial-plans';
test('Essential aylık fiyatı ve 12 ay peşin toplamı doğru hesaplanır',()=>{
 const plan=commercialPlans[0];assert.equal(planPricing(plan).monthly,319);assert.equal(planPricing(plan).total,319);
 assert.deepEqual(planPricing(plan,'yearly'),{monthly:259,total:3108,annualSavings:720});
});
test('Signature aylık fiyatı ve 12 ay peşin toplamı doğru hesaplanır',()=>{
 const plan=commercialPlans[1];assert.equal(planPricing(plan).monthly,549);assert.equal(planPricing(plan).total,549);
 assert.deepEqual(planPricing(plan,'yearly'),{monthly:400,total:4800,annualSavings:1788});
});
test('Yıllık toplam aylık karşılığın 12 katıdır; her iki plan yıllıkta daha uygundur',()=>{
 for(const plan of commercialPlans){const annual=planPricing(plan,'yearly');assert.equal(annual.total,annual.monthly*12);assert.equal(annual.annualSavings,plan.monthlyPrice*12-annual.total);assert.ok(annual.total<plan.monthlyPrice*12)}
 assert.equal(formatPrice(3108),'3.108');assert.match(planPriceLabel(commercialPlans[0],'yearly'),/259 TL.*12 ay peşin/);
});
test('Geçersiz sorgu dönemi güvenli aylık varsayımına döner',()=>{
 assert.equal(billingPeriod('yearly'),'yearly');for(const value of [undefined,null,'annual','monthly','yearly&price=0',['yearly']])assert.equal(billingPeriod(value),'monthly');
});
