import { relations } from "drizzle-orm/relations";
import { users, linkedinProfiles, sessions, userRoles, monthlyQuotas, linkedinLeads, tags, scrapeJobs, leadPositions, leadTags, monthlyUsage } from "./schema";

export const linkedinProfilesRelations = relations(linkedinProfiles, ({one}) => ({
	user: one(users, {
		fields: [linkedinProfiles.ownerId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	linkedinProfiles: many(linkedinProfiles),
	sessions: many(sessions),
	userRoles: many(userRoles),
	monthlyQuotas: many(monthlyQuotas),
	linkedinLeads: many(linkedinLeads),
	tags: many(tags),
	scrapeJobs: many(scrapeJobs),
	monthlyUsages: many(monthlyUsage),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id]
	}),
}));

export const monthlyQuotasRelations = relations(monthlyQuotas, ({one}) => ({
	user: one(users, {
		fields: [monthlyQuotas.userId],
		references: [users.id]
	}),
}));

export const linkedinLeadsRelations = relations(linkedinLeads, ({one, many}) => ({
	user: one(users, {
		fields: [linkedinLeads.ownerId],
		references: [users.id]
	}),
	leadPositions: many(leadPositions),
	leadTags: many(leadTags),
}));

export const tagsRelations = relations(tags, ({one, many}) => ({
	user: one(users, {
		fields: [tags.ownerId],
		references: [users.id]
	}),
	leadTags: many(leadTags),
}));

export const scrapeJobsRelations = relations(scrapeJobs, ({one}) => ({
	user: one(users, {
		fields: [scrapeJobs.ownerId],
		references: [users.id]
	}),
}));

export const leadPositionsRelations = relations(leadPositions, ({one}) => ({
	linkedinLead: one(linkedinLeads, {
		fields: [leadPositions.leadId],
		references: [linkedinLeads.id]
	}),
}));

export const leadTagsRelations = relations(leadTags, ({one}) => ({
	linkedinLead: one(linkedinLeads, {
		fields: [leadTags.leadId],
		references: [linkedinLeads.id]
	}),
	tag: one(tags, {
		fields: [leadTags.tagId],
		references: [tags.id]
	}),
}));

export const monthlyUsageRelations = relations(monthlyUsage, ({one}) => ({
	user: one(users, {
		fields: [monthlyUsage.userId],
		references: [users.id]
	}),
}));