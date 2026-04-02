"use strict";

module.exports = {
  // Auth
  "auth.register": { description: "Register a new account", roles: ["customer", "admin"] },
  "auth.login": { description: "Login to the platform", roles: ["customer", "staff", "admin"] },

  // User
  "user.getProfile": { description: "View own profile", roles: ["customer", "staff", "admin"] },
  "user.updateProfile": { description: "Update own profile", roles: ["customer", "staff", "admin"] },
  "user.listUsers": { description: "List all users", roles: ["admin"] },
  "user.deleteUser": { description: "Delete a user", roles: ["admin"] },

  // Tour Packages
  "tourPackage.list": { description: "Browse tour packages", roles: ["customer", "staff", "admin"] },
  "tourPackage.get": { description: "View package detail", roles: ["customer", "staff", "admin"] },
  "tourPackage.create": { description: "Create a tour package", roles: ["admin"] },
  "tourPackage.update": { description: "Update a tour package", roles: ["admin"] },
  "tourPackage.toggleActive": { description: "Activate/deactivate a package", roles: ["admin"] },

  // Dynamic Tour
  "dynamicTour.getDestinations": { description: "List available destinations for builder", roles: ["customer", "staff", "admin"] },
  "dynamicTour.getOptions": { description: "Get hotel/attraction/dining options", roles: ["customer", "staff", "admin"] },
  "dynamicTour.submit": { description: "Submit tour for pricing", roles: ["customer"] },
  "dynamicTour.getMyRequests": { description: "View own tour requests", roles: ["customer"] },
  "dynamicTour.cancelRequest": { description: "Cancel own tour request", roles: ["customer"] },

  // Pricing Desk
  "pricingDesk.getQueue": { description: "View pricing queue", roles: ["staff", "admin"] },
  "pricingDesk.assignQuote": { description: "Assign quote to self", roles: ["staff", "admin"] },
  "pricingDesk.submitQuote": { description: "Submit calculated quote", roles: ["staff", "admin"] },
  "pricingDesk.sendToCustomer": { description: "Send quote to customer", roles: ["staff", "admin"] },
  "pricingDesk.getSLAMetrics": { description: "View SLA compliance metrics", roles: ["admin"] },

  // Booking
  "booking.create": { description: "Create a booking", roles: ["customer"] },
  "booking.get": { description: "View booking detail", roles: ["customer", "staff", "admin"] },
  "booking.list": { description: "List bookings (scoped by role)", roles: ["customer", "staff", "admin"] },
  "booking.updateStatus": { description: "Update booking status", roles: ["staff", "admin"] },
  "booking.cancel": { description: "Cancel a booking", roles: ["customer", "staff", "admin"] },
  "booking.forceCancel": { description: "Force cancel any booking", roles: ["admin"] },

  // Payment
  "payment.initiate": { description: "Initiate a payment", roles: ["customer"] },
  "payment.verify": { description: "Verify payment callback", roles: ["customer", "staff", "admin"] },
  "payment.refund": { description: "Process a refund", roles: ["admin"] },
  "payment.getTransactions": { description: "View transactions", roles: ["customer", "staff", "admin"] },
  "payment.reconcile": { description: "Reconcile payments", roles: ["admin"] },

  // Payment Plan
  "paymentPlan.get": { description: "View payment plan", roles: ["customer", "staff", "admin"] },
  "paymentPlan.payMilestone": { description: "Pay a milestone", roles: ["customer"] },

  // Contract
  "contract.get": { description: "View contract", roles: ["customer", "staff", "admin"] },
  "contract.accept": { description: "Accept contract", roles: ["customer"] },
  "contract.list": { description: "List all contracts", roles: ["admin"] },

  // Interest (Expression of Interest)
  "interest.submit": { description: "Submit expression of interest", roles: ["customer"] },
  "interest.list": { description: "List all interests", roles: ["staff", "admin"] },
  "interest.update": { description: "Update interest status", roles: ["admin"] },

  // Partners (all partner types share these patterns)
  "partner.list": { description: "List partners", roles: ["customer", "staff", "admin"] },
  "partner.get": { description: "View partner detail", roles: ["customer", "staff", "admin"] },
  "partner.create": { description: "Register new partner", roles: ["admin"] },
  "partner.update": { description: "Update partner info", roles: ["admin"] },
  "partner.setCommission": { description: "Set partner commission rate", roles: ["admin"] },

  // Destination
  "destination.list": { description: "List destinations", roles: ["customer", "staff", "admin"] },
  "destination.get": { description: "View destination detail", roles: ["customer", "staff", "admin"] },
  "destination.create": { description: "Create destination", roles: ["admin"] },
  "destination.update": { description: "Update destination", roles: ["admin"] },

  // Email & Notification (internal only, triggered by events)
  "email.send": { description: "Send email (internal)", roles: ["staff", "admin"] },
  "notification.send": { description: "Send notification (internal)", roles: ["staff", "admin"] },
  "notification.list": { description: "View own notifications", roles: ["customer", "staff", "admin"] },
  "notification.markRead": { description: "Mark notification read", roles: ["customer", "staff", "admin"] },

  // Media
  "media.upload": { description: "Upload media file", roles: ["staff", "admin"] },
  "media.delete": { description: "Delete media file", roles: ["admin"] },
  "media.list": { description: "List media files", roles: ["admin"] },

  // Partner Confirmation (booking flow)
  "booking.confirmPartner": { description: "Confirm partner availability for booking", roles: ["staff", "admin"] },
  "booking.rejectPartner": { description: "Reject partner for booking", roles: ["staff", "admin"] },
  "booking.suggestSubstitution": { description: "Get alternative partners for booking", roles: ["staff", "admin"] },
  "booking.acceptSubstitution": { description: "Accept partner substitution", roles: ["staff", "admin"] },

  // Partner Availability (internal)
  "hotelPartner.checkAvailability": { description: "Check hotel availability and close-outs", roles: ["staff", "admin"] },

  // Search
  "tourPackage.search": { description: "Search tour packages", roles: ["customer", "staff", "admin"] },
  "destination.search": { description: "Search destinations", roles: ["customer", "staff", "admin"] },

  // Analytics
  "booking.getAnalytics": { description: "View booking analytics", roles: ["admin"] },
  "booking.getOccupancyReport": { description: "View occupancy report", roles: ["admin"] },
  "payment.getPaymentAnalytics": { description: "View payment analytics", roles: ["admin"] },
  "payment.getRevenueByPeriod": { description: "View revenue by period", roles: ["admin"] },
  "pricingDesk.estimateCost": { description: "Auto-estimate tour cost from partner data", roles: ["staff", "admin"] },

  // Dynamic Tour
  "dynamicTour.buildTourRequest": { description: "Build a custom tour request", roles: ["customer"] },

  // Contract
  "contract.sendToCustomer": { description: "Send contract to customer", roles: ["staff", "admin"] },

  // Payment Plan (internal/automated)
  "paymentPlan.checkOverdue": { description: "Check and mark overdue milestones", roles: ["admin"] },
  "paymentPlan.sendReminders": { description: "Send payment reminders", roles: ["admin"] },

  // Notification
  "notification.getUnreadCount": { description: "Get unread notification count", roles: ["customer", "staff", "admin"] },
  "notification.markAllRead": { description: "Mark all notifications as read", roles: ["customer", "staff", "admin"] },
  "notification.bulkSend": { description: "Send bulk notifications", roles: ["admin"] },

  // Interest
  "interest.getInterestCount": { description: "Get interest count for package", roles: ["staff", "admin"] },
  "interest.withdraw": { description: "Withdraw expression of interest", roles: ["customer"] },
  "interest.convertToBulkInvitation": { description: "Convert interests to booking invitations", roles: ["admin"] },

  // Review
  "review.listByTour": { description: "List tour reviews", roles: ["customer", "staff", "admin"] },
  "review.create": { description: "Create a review", roles: ["customer"] },
  "review.update": { description: "Update own review", roles: ["customer"] },
  "review.delete": { description: "Delete review", roles: ["customer", "admin"] },
  "review.addResponse": { description: "Respond to review", roles: ["admin"] },
  "review.getStats": { description: "Get review stats", roles: ["customer", "staff", "admin"] },

  // Contact
  "contact.submit": { description: "Submit contact form", roles: ["customer", "staff", "admin"] },
  "contact.submitNewsletter": { description: "Subscribe to newsletter", roles: ["customer", "staff", "admin"] },

  // Admin Dashboard
  "admin.dashboard": { description: "View admin dashboard KPIs", roles: ["admin"] },
  "admin.settings": { description: "Manage platform settings", roles: ["admin"] },
  "admin.staffManagement": { description: "Manage staff accounts", roles: ["admin"] },

  // Super Admin / Platform
  "superAdmin.listOrganizations": { description: "List all organizations", roles: ["super_admin"] },
  "superAdmin.getOrganization": { description: "View organization details", roles: ["super_admin"] },
  "superAdmin.createOrganization": { description: "Create new organization", roles: ["super_admin"] },
  "superAdmin.suspendOrganization": { description: "Suspend an organization", roles: ["super_admin"] },
  "superAdmin.activateOrganization": { description: "Activate an organization", roles: ["super_admin"] },
  "superAdmin.getPlatformHealth": { description: "View platform health", roles: ["super_admin"] },
  "superAdmin.getCrossOrgRevenue": { description: "View cross-org revenue", roles: ["super_admin"] },
  "superAdmin.getCrossOrgAnalytics": { description: "View cross-org analytics", roles: ["super_admin"] },
  "organization.getConfig": { description: "Get org config", roles: ["admin", "super_admin"] },
  "organization.setConfig": { description: "Set org config value", roles: ["super_admin"] },
  "organization.mergeConfig": { description: "Merge org config", roles: ["super_admin"] },
  "organization.deleteConfigKey": { description: "Delete org config key", roles: ["super_admin"] },

  // Waitlist
  "tourPackage.joinWaitlist": { description: "Join tour waitlist", roles: ["customer"] },
  "tourPackage.getWaitlist": { description: "View tour waitlist", roles: ["staff", "admin"] },

  // Proximity & Views
  "tourPackage.incrementViewCount": { description: "Increment view count", roles: ["customer", "staff", "admin"] },
  "hotelPartner.findNearby": { description: "Find nearby hotels", roles: ["customer", "staff", "admin"] },
  "attraction.findNearby": { description: "Find nearby attractions", roles: ["customer", "staff", "admin"] },
  "dining.findNearby": { description: "Find nearby dining", roles: ["customer", "staff", "admin"] },
  "destination.findNearbyPartners": { description: "Find partners near destination", roles: ["customer", "staff", "admin"] },
  "tourPackage.getProximityMap": { description: "Get package proximity map", roles: ["customer", "staff", "admin"] },
};
