import { useLocalSearchParams } from "expo-router";
import { CoursesView } from "@/features/courses/courses-view";

export default function CoursesScreen() {
  const params = useLocalSearchParams<{ category?: string; series?: string }>();
  return <CoursesView initialCategory={typeof params.category === "string" ? params.category : ""} series={typeof params.series === "string" ? params.series : ""} />;
}
