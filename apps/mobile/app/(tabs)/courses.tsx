import { useLocalSearchParams } from "expo-router";
import { CoursesView } from "@/features/courses/courses-view";

export default function CoursesScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  return <CoursesView initialCategory={typeof params.category === "string" ? params.category : ""} />;
}
