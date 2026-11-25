// The owner's contact details, shown to chefs on their account page so they know who to ask
// when they need a new password. They are written here on purpose and are not in the database.
// Edit the values below. Leave one empty ('') to hide it.
export class OwnerContact {
    static readonly email = 'registrarbites@gmail.com';
    static readonly phone = '(876) 874 - 2830';

    static details(): { email: string | null; phone: string | null } {
        return {
            email: OwnerContact.email || null,
            phone: OwnerContact.phone || null,
        };
    }
}
