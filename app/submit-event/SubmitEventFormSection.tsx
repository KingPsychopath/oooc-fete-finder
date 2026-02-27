import { SubmitEventForm } from "@/features/events/submissions/SubmitEventForm";
import { EventSubmissionSettingsStore } from "@/features/events/submissions/settings-store";

export async function SubmitEventFormSection() {
	const settings = await EventSubmissionSettingsStore.getPublicSettings();
	return <SubmitEventForm submissionsEnabled={settings.enabled} />;
}
