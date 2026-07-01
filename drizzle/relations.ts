import { relations } from "drizzle-orm/relations";
import { users, attendances, biometricRegistrations, certificateTemplates, certificates, seminars, registrations, speakers } from "./schema";

export const attendancesRelations = relations(attendances, ({one}) => ({
	user: one(users, {
		fields: [attendances.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	attendances: many(attendances),
	biometricRegistrations: many(biometricRegistrations),
	certificates: many(certificates),
}));

export const biometricRegistrationsRelations = relations(biometricRegistrations, ({one}) => ({
	user: one(users, {
		fields: [biometricRegistrations.userId],
		references: [users.id]
	}),
}));

export const certificatesRelations = relations(certificates, ({one}) => ({
	certificateTemplate: one(certificateTemplates, {
		fields: [certificates.templateId],
		references: [certificateTemplates.id]
	}),
	user: one(users, {
		fields: [certificates.userId],
		references: [users.id]
	}),
}));

export const certificateTemplatesRelations = relations(certificateTemplates, ({many}) => ({
	certificates: many(certificates),
}));

export const registrationsRelations = relations(registrations, ({one}) => ({
	seminar: one(seminars, {
		fields: [registrations.seminarId],
		references: [seminars.id]
	}),
}));

export const seminarsRelations = relations(seminars, ({many}) => ({
	registrations: many(registrations),
	speakers: many(speakers),
}));

export const speakersRelations = relations(speakers, ({one}) => ({
	seminar: one(seminars, {
		fields: [speakers.seminarId],
		references: [seminars.id]
	}),
}));