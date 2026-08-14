import localFont from 'next/font/local'
import { Raleway } from 'next/font/google'

export const geist = localFont({
  src: [
    {
      path: '../../public/fonts/Geist-Thin.woff2',
      weight: '100',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Geist-ExtraLight.woff2',
      weight: '200',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Geist-Light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Geist-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Geist-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Geist-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Geist-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Geist-ExtraBold.woff2',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Geist-Black.woff2',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-geist',
  display: 'swap',
})

export const quicheSans = localFont({
  src: [
    {
      path: '../../public/fonts/QuicheSans-Thin.otf',
      weight: '100',
      style: 'normal',
    },
    {
      path: '../../public/fonts/QuicheSans-Light.otf',
      weight: '300',
      style: 'normal',
    },
  ],
  variable: '--font-quiche-sans',
  display: 'swap',
})

export const ralewayExtraLight = Raleway({
  subsets: ['latin'],
  weight: '200',
  style: 'normal',
  variable: '--font-raleway',
  display: 'swap',
})
