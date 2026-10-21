import 'server-only';
export const internalApiUrl=()=>process.env.INTERNAL_API_URL||`http://127.0.0.1:${process.env.API_PORT||4000}`;
export const internalApiKey=()=>process.env.INTERNAL_API_KEY||(process.env.NODE_ENV!=='production'?process.env.DEV_API_KEY:'')||'';

export {privateApiFetch as internalApiFetch} from '../../../packages/runtime/private-api.cjs';
