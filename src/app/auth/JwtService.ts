import { Injectable } from '@angular/core';
import * as jwt_decode from 'jwt-decode';

@Injectable({
	providedIn: 'root'
})
export class JwtService {
	/**
	 *
	 */
	constructor() {}

	deocdeToken = (token: string): any => {
		try {
			return jwt_decode.jwtDecode(token);
		} catch (error) {
			console.error('Invalid token:', error);
			return '';
		}
	};
}
