import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { DeleteAction } from "./delete-action";
test("requires confirmation and returns focus on Escape without deleting",()=>{
 const remove=vi.fn();render(<DeleteAction label="Delete 高得要命" title="Delete this expression?" description="Only this item will be removed." onConfirm={remove} />);
 const trigger=screen.getByRole("button",{name:"Delete 高得要命"});
 expect(trigger).toHaveTextContent(/^$/);
 expect(trigger).toHaveAttribute("title","Delete 高得要命");
 fireEvent.click(trigger);
 expect(screen.getByRole("dialog",{name:"Delete this expression?"})).toBeInTheDocument();
 expect(remove).not.toHaveBeenCalled();fireEvent.keyDown(screen.getByRole("dialog"),{key:"Escape"});
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();expect(trigger).toHaveFocus();
});
test("keeps failed deletion open with retry and disables duplicate submissions",async()=>{
 let reject!:(reason:Error)=>void;const remove=vi.fn(()=>new Promise<void>((_,r)=>{reject=r}));
 render(<DeleteAction label="Delete word" title="Delete this expression?" description="Only this item." onConfirm={remove} />);
 fireEvent.click(screen.getByRole("button",{name:"Delete word"}));fireEvent.click(screen.getByRole("button",{name:"Delete expression"}));
 expect(screen.getByRole("button",{name:"Deleting…"})).toBeDisabled();expect(screen.getByRole("button",{name:"Cancel"})).toBeDisabled();
 reject(new Error("private"));await screen.findByRole("alert");expect(screen.getByRole("button",{name:"Delete expression"})).toBeEnabled();
 remove.mockImplementationOnce(async()=>{});fireEvent.click(screen.getByRole("button",{name:"Delete expression"}));
 await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());expect(remove).toHaveBeenCalledTimes(2);
});
