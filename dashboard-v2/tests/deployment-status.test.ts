import {describe,it,expect} from 'vitest';
import {deploymentStatus} from '../server/deployment-status';
describe('reported deployment status',()=>{
 it('confirms queued deployments only with a fresh receipt',()=>{
  const queued={stage:'Start requested',confirmed:false};
  expect(deploymentStatus(queued,null).confirmed).toBe(false);
  expect(deploymentStatus(queued,{live:true,lastSeen:100}).stage).toBe('Running');
  expect(deploymentStatus(queued,{live:true,lastSeen:100}).confirmed).toBe(true);
 });
 it('withdraws confirmation when telemetry becomes stale',()=>{
  expect(deploymentStatus({stage:'Start requested'},{live:false,lastSeen:100}).stage).toBe('Telemetry stale');
  expect(deploymentStatus({stage:'Stopped'},{live:false,lastSeen:100}).stage).toBe('Stopped');
 });
 it('preserves current operation progress',()=>{
  expect(deploymentStatus({stage:'Uploading CODE',busy:true},{live:true}).stage).toBe('Uploading CODE');
 });
});
