import {
  Apple, Candy, Coffee, CookingPot, Drumstick, Egg, Leaf, Milk, Nut, Popcorn, Soup, Sunrise, Wheat, Citrus, Salad, Bean,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/lib/types";

// Placeholder art until the illustration set (D11) exists: one spice-toned tile per category.
const STYLE: Record<Category, { icon: LucideIcon; hue: string }> = {
  breakfast: { icon: Sunrise, hue: "#f6c343" },
  roti_bread: { icon: Wheat, hue: "#d9a15b" },
  rice: { icon: Salad, hue: "#e9dcc6" },
  dal: { icon: Bean, hue: "#f2b134" },
  sabzi: { icon: Leaf, hue: "#7cc36e" },
  paneer: { icon: CookingPot, hue: "#f3d9a4" },
  egg: { icon: Egg, hue: "#ffd166" },
  non_veg: { icon: Drumstick, hue: "#ff7a59" },
  snack: { icon: Popcorn, hue: "#ff9f45" },
  sweet: { icon: Candy, hue: "#ff7aa2" },
  dairy: { icon: Milk, hue: "#cfe3ff" },
  fruit: { icon: Apple, hue: "#ff6b6b" },
  beverage: { icon: Coffee, hue: "#c08457" },
  condiment: { icon: Citrus, hue: "#b5d335" },
  nuts: { icon: Nut, hue: "#c9974c" },
  soup: { icon: Soup, hue: "#ff8a3d" },
};

export const categoryHue = (cat: Category) => STYLE[cat].hue;

export function FoodIcon({ cat, size = 44 }: { cat: Category; size?: number }) {
  const { icon: Icon, hue } = STYLE[cat];
  return (
    <div
      className="grid shrink-0 place-items-center rounded-2xl"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, ${hue}40, ${hue}14 70%)`,
        boxShadow: `inset 0 0 0 1px ${hue}30`,
      }}
    >
      <Icon size={size * 0.46} color={hue} strokeWidth={1.8} />
    </div>
  );
}
