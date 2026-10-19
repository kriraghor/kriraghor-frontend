/**
 * Site photography (launch polish): free-licence Unsplash photos, self-hosted in public/images and
 * served through next/image. Sources and photographers are in public/images/CREDITS.md. Photos are
 * decorative (the text next to them carries the meaning), so they use empty alt text.
 */
export const PHOTOS = {
  esports: "/images/esports-mobile.jpg",
  groundsNight: "/images/grounds-futsal-night.jpg",
  groundsFloodlit: "/images/grounds-floodlit.jpg",
  cricket: "/images/sport-cricket.jpg",
  badminton: "/images/sport-badminton.jpg",
  shopGear: "/images/shop-gear.jpg",
  shopSupplements: "/images/shop-supplements.jpg",
  shopGymGear: "/images/shop-gym-gear.jpg",
  hire: "/images/hire-referee.jpg",
  gym: "/images/gym-training.jpg",
  tournaments: "/images/tournaments-futsal.jpg",
} as const;

export type PhotoKey = keyof typeof PHOTOS;
