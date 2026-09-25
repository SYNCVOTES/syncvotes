import { SyncVotes } from '@daml.js/model';

/** The package's templates by name, wherever they sit among its modules. */
export const Templates = {
	Account: SyncVotes.Account.Account,
	Profile: SyncVotes.Account.Profile,
	DAO: SyncVotes.Governance.DAO,
	Member: SyncVotes.Governance.Member,
	Proposal: SyncVotes.Governance.Proposal,
	Ballot: SyncVotes.Governance.Ballot,
	Comment: SyncVotes.Governance.Comment,
	Meter: SyncVotes.Billing.Meter,
	Purse: SyncVotes.Billing.Purse
};
