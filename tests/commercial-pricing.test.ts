import test from 'node:test';
import assert from 'node:assert/strict';
import {commercialPlans,planPricing,billingPeriod,formatPrice,planPriceLabel} from '../packages/domain/commercial-plans';
test('Essential aylık fiyatı ve 12 ay peşin toplamı doğru hesaplanır',()=>{
 const plan=commercialPlans[0];assert.equal(planPricing(plan).monthly,249);assert.equal(planPricing(plan).total,249);
 assert.deepEqual(planPricing(plan,'yearly'),{monthly:199,total:2388,annualSavings:600});
});
test('Signature aylık fiyatı ve 12 ay peşin toplamı doğru hesaplanır',()=>{
 const plan=commercialPlans[1];assert.equal(planPricing(plan).monthly,499);assert.equal(planPricing(plan).total,499);
 assert.deepEqual(planPricing(plan,'yearly'),{monthly:399,total:4788,annualSavings:1200});
});
test('Yıllık toplam aylık karşılığın 12 katıdır; her iki plan yıllıkta daha uygundur',()=>{
 for(const plan of commercialPlans){const annual=planPricing(plan,'yearly');assert.equal(annual.total,annual.monthly*12);assert.equal(annual.annualSavings,plan.monthlyPrice*12-annual.total);assert.ok(annual.total<plan.monthlyPrice*12)}
 assert.equal(formatPrice(2388),'2.388');assert.match(planPriceLabel(commercialPlans[0],'yearly'),/199 TL.*12 ay peşin/);
});
test('Geçersiz sorgu dönemi güvenli aylık varsayımına döner',()=>{
 assert.equal(billingPeriod('yearly'),'yearly');for(const value of [undefined,null,'annual','monthly','yearly&price=0',['yearly']])assert.equal(billingPeriod(value),'monthly');
});
