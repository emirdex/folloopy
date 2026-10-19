import {redirect} from 'next/navigation';
import {requireAccount} from '../../account-api';
export default async function Guide(){await requireAccount();redirect('/panel?view=guide')}
