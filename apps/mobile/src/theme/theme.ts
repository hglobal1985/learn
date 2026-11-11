import { useColorScheme } from "react-native";
import { colors, type ColorScheme, type Palette } from "./tokens";

export function useTheme(): { scheme: ColorScheme; c: Palette } {
  const scheme: ColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  return { scheme, c: colors[scheme] };
}
