"use client";
import { BadgeCheck, Copy, Plus, Search, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { USER_STATUSES, label, ACCOUNT_TYPES, type Role } from "@/lib/constants";
import { applyServerErrors, toApiError, zodForm } from "@/lib/forms";
import { createCustomerSchema } from "@/lib/validators";
import { useCreateCustomerMutation, useListCustomersQuery } from "@/store/api";
import { useAppDispatch } from "@/store/hooks";
import { pushToast } from "@/store/slices/uiSlice";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, Modal, Money, Pagination, Select, StatusBadge, TableShell, TableSkeleton } from "../ui";

const base = (r: Role) => (r === "ADMIN" ? "/admin" : "/staff");

export function CustomerList({ role }: { role: Role }) {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [status, setStatus] = useState("");
  const [verified, setVerified] = useState("");
  const [page, setPage] = useState(1);
  const [register, setRegister] = useState(false);
  useEffect(() => { const h = setTimeout(() => { setDq(q); setPage(1); }, 350); return () => clearTimeout(h); }, [q]);
  const { data, isLoading, isFetching, isError, refetch } = useListCustomersQuery({ q: dq || undefined, status: status || undefined, verified: verified || undefined, page, pageSize: 10 });
  return (
    <>
      <Card padded={false}>
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_auto]">
          <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-[13px] size-4 text-muted" /><input aria-label="Search customers" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, account no…" className="input pl-10" /></div>
          <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{USER_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select aria-label="Verification" value={verified} onChange={(e) => { setVerified(e.target.value); setPage(1); }}><option value="">Any verification</option><option value="true">Verified</option><option value="false">Not verified</option></Select>
          <Button icon={<UserPlus className="size-4" />} onClick={() => setRegister(true)}>Register customer</Button>
        </div>
        {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <TableSkeleton cols={6} /> : !data?.items.length ? <EmptyState icon={<Users />} title="No customers found" description="Try another search or register a new customer." /> : (
          <>
            <TableShell>
              <thead><tr className="border-b border-border bg-surface-2/60"><th className="th">Customer</th><th className="th">Contact</th><th className="th text-right">Accounts</th><th className="th text-right">Total balance</th><th className="th">Verification</th><th className="th">Status</th></tr></thead>
              <tbody className="divide-y divide-border">{data.items.map((c) => (
                <tr key={c.id} className="transition hover:bg-surface-2/70">
                  <td className="td"><Link href={`${base(role)}/customers/${c.id}`} className="flex items-center gap-3"><Avatar name={c.name} /><span><span className="block text-sm font-semibold hover:text-primary">{c.name}</span><span className="font-mono text-xs text-muted">{c.customerNumber}</span></span></Link></td>
                  <td className="td text-[13px]"><p>{c.email}</p><p className="text-xs text-muted">{c.phone}</p></td>
                  <td className="td tabular text-right">{c.accountsCount}</td>
                  <td className="td text-right font-semibold"><Money value={c.totalBalance} /></td>
                  <td className="td">{c.verified ? <Badge tone="success"><BadgeCheck className="size-3.5" />Verified</Badge> : <Badge tone="warning">Pending</Badge>}</td>
                  <td className="td"><StatusBadge status={c.status} /></td>
                </tr>))}</tbody>
            </TableShell>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} loading={isFetching} onPage={setPage} />
          </>
        )}
      </Card>
      {register && <RegisterModal onClose={() => setRegister(false)} />}
    </>
  );
}

type In = z.input<typeof createCustomerSchema>;
type Out = z.output<typeof createCustomerSchema>;

function RegisterModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [create, { isLoading }] = useCreateCustomerMutation();
  const [creds, setCreds] = useState<{ email: string; password?: string; pin?: string; account?: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<In, unknown, Out>({ resolver: zodForm(createCustomerSchema), defaultValues: { accountType: "SAVINGS", openingDeposit: 0 } });
  const onSubmit = async (v: Out) => {
    setFormError(null);
    try {
      const r = await create(v).unwrap();
      setCreds({ ...r.temporaryCredentials, account: r.account?.accountNumber });
      dispatch(pushToast({ kind: "success", title: "Customer registered" }));
    } catch (e) { setFormError(applyServerErrors(toApiError(e), setError, ["name", "email", "phone", "address", "dateOfBirth", "nationalId", "password", "pin", "accountType", "openingDeposit"])); }
  };
  if (creds) {
    const text = `Email: ${creds.email}\n${creds.password ? `Temporary password: ${creds.password}\n` : ""}${creds.pin ? `Temporary PIN: ${creds.pin}\n` : ""}${creds.account ? `Account: ${creds.account}` : ""}`;
    return (
      <Modal open onClose={onClose} title="Customer registered" description="Share these credentials securely. They are shown only once." footer={<><Button variant="secondary" icon={<Copy className="size-4" />} onClick={() => navigator.clipboard?.writeText(text)}>Copy</Button><Button onClick={onClose}>Done</Button></>}>
        <pre className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 font-mono text-[13px] leading-relaxed">{text}</pre>
      </Modal>
    );
  }
  return (
    <Modal open onClose={onClose} size="lg" title="Register a new customer" dismissible={!isLoading}
      footer={<><Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button><Button form="reg-form" type="submit" loading={isLoading} icon={<Plus className="size-4" />}>Register</Button></>}>
      <form id="reg-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        {formError && <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger sm:col-span-2">{formError}</div>}
        <Input label="Full name" error={errors.name?.message} {...register("name")} />
        <Input label="Email" type="email" error={errors.email?.message} {...register("email")} />
        <Input label="Phone" error={errors.phone?.message} {...register("phone")} />
        <Input label="Date of birth" type="date" error={errors.dateOfBirth?.message} {...register("dateOfBirth")} />
        <Input wrapperClassName="sm:col-span-2" label="Address" error={errors.address?.message} {...register("address")} />
        <Input label="National ID" error={errors.nationalId?.message} hint="Used to verify the customer's identity." {...register("nationalId")} />
        <Select label="Open an account" error={errors.accountType?.message} {...register("accountType")}>{ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>
        <Input label="Opening deposit ($)" inputMode="decimal" error={errors.openingDeposit?.message as string | undefined} {...register("openingDeposit")} />
        <Input label="Temporary password (optional)" type="text" hint="Leave blank to auto-generate." error={errors.password?.message} {...register("password")} />
        <Input label="Transaction PIN (optional)" inputMode="numeric" maxLength={6} hint="Leave blank to auto-generate." error={errors.pin?.message} {...register("pin")} />
      </form>
    </Modal>
  );
}
