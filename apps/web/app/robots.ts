import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/admin','/panel','/odeme','/paketler','/hesap','/sifre-yenile','/sifremi-unuttum','/baglantilar','/t/']},sitemap:(process.env.SITE_URL||'https://folloopy.com')+'/sitemap.xml'}}
