import { text } from '@sveltejs/kit';
import { GIT_SHA } from '$app/env/private';
import { packageId } from '@daml.js/model';
import { PACKAGE_NAME } from '$lib/verify';

/**
 * What is running here: the commit (deploys refuse uncommitted trees, so it is always a real
 * one) and the Daml package it uploaded, by id. The id is what the participant knows the code by,
 * so anyone can match what runs here against the sources of that commit.
 */
export const GET = () => text(`commit ${GIT_SHA}\npackage ${PACKAGE_NAME} ${packageId}\n`);
