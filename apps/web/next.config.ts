import type {NextConfig} from 'next';
import {fileURLToPath} from 'node:url';
const config:NextConfig={poweredByHeader:false,experimental:{serverActions:{bodySizeLimit:'1mb'}},async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},...(process.env.NODE_ENV==='production'?[{key:'Strict-Transport-Security',value:'max-age=31536000'}]:[])]}]},turbopack:{root:fileURLToPath(new URL('../..',import.meta.url))}};
export default config;
